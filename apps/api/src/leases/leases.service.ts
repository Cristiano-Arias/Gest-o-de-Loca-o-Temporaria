import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/jwt-auth.guard';
import { InstallmentStatusInput, LeaseInput } from './lease.dto';

const incluir = {
  property: { select: { id: true, nome: true } },
  installments: { orderBy: { competencia: 'asc' } },
} satisfies Prisma.LeaseInclude;

type LeaseComRelacoes = Prisma.LeaseGetPayload<{ include: typeof incluir }>;

// Data (só dia, em UTC) a partir de 'AAAA-MM-DD' — evita o fuso "comer" um dia.
function dataDeISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

// 'AAAA-MM-DD' do dia de hoje (no horário do servidor).
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class LeasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const leases = await this.prisma.lease.findMany({
      where: { property: { userId: user.id } },
      orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }],
      include: incluir,
    });
    return leases.map((l) => this.toDTO(l));
  }

  async create(user: AuthUser, input: LeaseInput) {
    await this.assertProperty(user, input.propertyId);
    const lease = await this.prisma.lease.create({
      data: this.dadosLease(input),
    });
    await this.gerarMensalidades(lease.id);
    return this.findOne(user, lease.id);
  }

  async update(user: AuthUser, id: string, input: LeaseInput) {
    await this.assertOwnership(user, id);
    await this.assertProperty(user, input.propertyId);
    await this.prisma.lease.update({
      where: { id },
      data: this.dadosLease(input),
    });
    // Gera as mensalidades que faltam (sem mexer nas já existentes/pagas).
    await this.gerarMensalidades(id);
    return this.findOne(user, id);
  }

  async remove(user: AuthUser, id: string) {
    await this.assertOwnership(user, id);
    await this.prisma.lease.delete({ where: { id } });
    return { ok: true };
  }

  // Cria as mensalidades que ainda faltam até o mês atual (ou até o fim do contrato).
  async gerarMensalidades(leaseId: string) {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { installments: true },
    });
    if (!lease) return;

    const valor = Number(lease.valorMensal) + Number(lease.outrosCustos);
    const existentes = new Set(
      lease.installments.map((p) => p.competencia.toISOString().slice(0, 7)),
    );

    const inicio = lease.inicio;
    const hoje = dataDeISO(hojeISO());
    // Mês final: o fim do contrato (se houver) — gera a régua inteira;
    // sem fim definido, gera até o mês atual.
    const limite = lease.fim ?? hoje;

    // Índice de mês (ano*12+mês) facilita iterar sem erro de virada de ano.
    const iniIdx = inicio.getUTCFullYear() * 12 + inicio.getUTCMonth();
    const fimIdx = Math.max(
      iniIdx,
      limite.getUTCFullYear() * 12 + limite.getUTCMonth(),
    );

    const novas: Prisma.RentInstallmentCreateManyInput[] = [];
    for (let idx = iniIdx; idx <= fimIdx; idx++) {
      const y = Math.floor(idx / 12);
      const m = idx % 12;
      const chave = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!existentes.has(chave)) {
        const ultimoDia = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const dia = Math.min(lease.diaVencimento, ultimoDia);
        novas.push({
          leaseId,
          competencia: new Date(Date.UTC(y, m, 1)),
          vencimento: new Date(Date.UTC(y, m, dia)),
          valor,
        });
      }
    }

    if (novas.length) {
      await this.prisma.rentInstallment.createMany({
        data: novas,
        skipDuplicates: true,
      });
    }
  }

  async setInstallmentStatus(
    user: AuthUser,
    leaseId: string,
    installmentId: string,
    input: InstallmentStatusInput,
  ) {
    await this.assertOwnership(user, leaseId);
    const parcela = await this.prisma.rentInstallment.findFirst({
      where: { id: installmentId, leaseId },
    });
    if (!parcela) throw new NotFoundException('Mensalidade não encontrada.');

    const pago = input.status === 'PAGO';
    await this.prisma.rentInstallment.update({
      where: { id: installmentId },
      data: {
        status: input.status,
        pagoEm: pago ? dataDeISO(input.pagoEm ?? hojeISO()) : null,
      },
    });
    return this.findOne(user, leaseId);
  }

  async findOne(user: AuthUser, id: string) {
    const lease = await this.prisma.lease.findFirst({
      where: { id, property: { userId: user.id } },
      include: incluir,
    });
    if (!lease) throw new NotFoundException('Contrato não encontrado.');
    return this.toDTO(lease);
  }

  // --- auxiliares -------------------------------------------------------

  private dadosLease(input: LeaseInput) {
    return {
      propertyId: input.propertyId,
      inquilinoNome: input.inquilinoNome.trim(),
      inquilinoTelefone: input.inquilinoTelefone?.trim() || null,
      inquilinoEmail: input.inquilinoEmail?.trim() || null,
      inquilinoDocumento: input.inquilinoDocumento?.trim() || null,
      valorMensal: input.valorMensal,
      outrosCustos: input.outrosCustos ?? 0,
      outrosCustosDescricao: input.outrosCustosDescricao?.trim() || null,
      diaVencimento: input.diaVencimento,
      inicio: dataDeISO(input.inicio),
      fim: input.fim ? dataDeISO(input.fim) : null,
      incluiInternet: input.incluiInternet ?? false,
      incluiAgua: input.incluiAgua ?? false,
      incluiEnergia: input.incluiEnergia ?? false,
      observacoes: input.observacoes?.trim() || null,
    };
  }

  private async assertProperty(user: AuthUser, propertyId: string) {
    const imovel = await this.prisma.property.findFirst({
      where: { id: propertyId, userId: user.id },
      select: { id: true },
    });
    if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
  }

  private async assertOwnership(user: AuthUser, id: string) {
    const dono = await this.prisma.lease.findFirst({
      where: { id, property: { userId: user.id } },
      select: { id: true },
    });
    if (!dono) throw new NotFoundException('Contrato não encontrado.');
  }

  // Situação da mensalidade: PAGO / ATRASADO (em aberto e vencida) / EM_ABERTO.
  private situacao(
    status: string,
    vencimento: Date,
    hoje: Date,
  ): 'PAGO' | 'ATRASADO' | 'EM_ABERTO' {
    if (status === 'PAGO') return 'PAGO';
    return vencimento < hoje ? 'ATRASADO' : 'EM_ABERTO';
  }

  private toDTO(l: LeaseComRelacoes) {
    const hoje = dataDeISO(hojeISO());
    const mensalidades = l.installments.map((p) => ({
      id: p.id,
      competencia: p.competencia.toISOString().slice(0, 10),
      vencimento: p.vencimento.toISOString().slice(0, 10),
      valor: Number(p.valor),
      status: p.status,
      pagoEm: p.pagoEm ? p.pagoEm.toISOString().slice(0, 10) : null,
      situacao: this.situacao(p.status, p.vencimento, hoje),
    }));

    return {
      id: l.id,
      propertyId: l.propertyId,
      imovelNome: l.property.nome,
      inquilinoNome: l.inquilinoNome,
      inquilinoTelefone: l.inquilinoTelefone,
      inquilinoEmail: l.inquilinoEmail,
      inquilinoDocumento: l.inquilinoDocumento,
      valorMensal: Number(l.valorMensal),
      outrosCustos: Number(l.outrosCustos),
      outrosCustosDescricao: l.outrosCustosDescricao,
      diaVencimento: l.diaVencimento,
      inicio: l.inicio.toISOString().slice(0, 10),
      fim: l.fim ? l.fim.toISOString().slice(0, 10) : null,
      incluiInternet: l.incluiInternet,
      incluiAgua: l.incluiAgua,
      incluiEnergia: l.incluiEnergia,
      observacoes: l.observacoes,
      status: l.status,
      mensalidades,
    };
  }
}
