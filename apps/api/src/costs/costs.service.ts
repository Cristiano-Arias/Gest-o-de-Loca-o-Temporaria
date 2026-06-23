import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CostCategory,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseUser } from '../auth/supabase-auth.guard';
import { CostInput } from './cost.dto';

const incluir = { property: true } satisfies Prisma.CostInclude;
type CustoComImovel = Prisma.CostGetPayload<{ include: typeof incluir }>;

// Descrição que marca um custo gerado a partir de um custo fixo (idempotência).
const MARCA_FIXO = 'Custo fixo mensal';

@Injectable()
export class CostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: SupabaseUser,
    filtros: {
      propertyId?: string;
      categoria?: CostCategory;
      statusPagamento?: PaymentStatus;
    },
  ) {
    const where: Prisma.CostWhereInput = { property: { userId: user.id } };
    if (filtros.propertyId) where.propertyId = filtros.propertyId;
    if (filtros.categoria) where.categoria = filtros.categoria;
    if (filtros.statusPagamento) where.statusPagamento = filtros.statusPagamento;

    const custos = await this.prisma.cost.findMany({
      where,
      include: incluir,
      orderBy: { data: 'desc' },
    });
    return custos.map((c) => this.toDTO(c));
  }

  async create(user: SupabaseUser, input: CostInput) {
    await this.assertProperty(user, input.propertyId);
    const custo = await this.prisma.cost.create({
      data: {
        propertyId: input.propertyId,
        data: this.primeiroDia(input.mes),
        categoria: input.categoria,
        valor: input.valor,
        descricao: input.descricao?.trim() || null,
        statusPagamento: input.statusPagamento ?? PaymentStatus.PENDENTE,
      },
      include: incluir,
    });
    return this.toDTO(custo);
  }

  async update(user: SupabaseUser, id: string, input: CostInput) {
    await this.assertOwnership(user, id);
    await this.assertProperty(user, input.propertyId);
    const custo = await this.prisma.cost.update({
      where: { id },
      data: {
        propertyId: input.propertyId,
        data: this.primeiroDia(input.mes),
        categoria: input.categoria,
        valor: input.valor,
        descricao: input.descricao?.trim() || null,
        statusPagamento: input.statusPagamento ?? PaymentStatus.PENDENTE,
      },
      include: incluir,
    });
    return this.toDTO(custo);
  }

  async remove(user: SupabaseUser, id: string) {
    await this.assertOwnership(user, id);
    await this.prisma.cost.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Materializa os custos fixos (RecurringCost) de um mês em lançamentos (Cost).
   * Idempotente: não duplica se já existir o mesmo (imóvel, categoria, mês)
   * marcado como "Custo fixo mensal". Espelha lancarFixos() do protótipo.
   */
  async lancarFixos(user: SupabaseUser, propertyId?: string, mes?: string) {
    const ym = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : this.mesAtual();
    const data = this.primeiroDia(ym);

    const imoveis = await this.prisma.property.findMany({
      where: { userId: user.id, ...(propertyId ? { id: propertyId } : {}) },
      include: { recurringCosts: { where: { ativo: true } } },
    });

    let lancados = 0;
    for (const p of imoveis) {
      for (const cf of p.recurringCosts) {
        const existe = await this.prisma.cost.findFirst({
          where: {
            propertyId: p.id,
            categoria: cf.categoria,
            data,
            descricao: MARCA_FIXO,
          },
          select: { id: true },
        });
        if (!existe) {
          await this.prisma.cost.create({
            data: {
              propertyId: p.id,
              data,
              categoria: cf.categoria,
              valor: cf.valorMensal,
              descricao: MARCA_FIXO,
              statusPagamento: PaymentStatus.PENDENTE,
            },
          });
          lancados++;
        }
      }
    }
    return { lancados };
  }

  // --- auxiliares -------------------------------------------------------

  // 'AAAA-MM' → Date do primeiro dia do mês (meia-noite UTC).
  private primeiroDia(mes: string): Date {
    return new Date(`${mes}-01T00:00:00.000Z`);
  }

  private mesAtual(): string {
    const t = new Date();
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private async assertProperty(user: SupabaseUser, propertyId: string) {
    const dono = await this.prisma.property.findFirst({
      where: { id: propertyId, userId: user.id },
      select: { id: true },
    });
    if (!dono) throw new NotFoundException('Imóvel não encontrado.');
  }

  private async assertOwnership(user: SupabaseUser, id: string) {
    const custo = await this.prisma.cost.findFirst({
      where: { id, property: { userId: user.id } },
      select: { id: true },
    });
    if (!custo) throw new NotFoundException('Custo não encontrado.');
  }

  private toDTO(c: CustoComImovel) {
    const ymd = c.data.toISOString().slice(0, 10);
    return {
      id: c.id,
      propertyId: c.propertyId,
      propertyNome: c.property.nome,
      mes: ymd.slice(0, 7),
      data: ymd,
      categoria: c.categoria,
      valor: Number(c.valor),
      descricao: c.descricao ?? '',
      statusPagamento: c.statusPagamento,
    };
  }
}
