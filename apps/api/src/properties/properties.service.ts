import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseUser } from '../auth/supabase-auth.guard';
import { PropertyInput, RecurringCostInput } from './property.dto';

// Inclui os relacionamentos que a tela de Imóveis precisa.
const incluir = {
  listings: { include: { platform: true } },
  recurringCosts: true,
} satisfies Prisma.PropertyInclude;

type ImovelComRelacoes = Prisma.PropertyGetPayload<{ include: typeof incluir }>;

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante que o usuário (dono dos dados, multi-tenant) exista localmente
   * antes de gravar qualquer imóvel. O id é o mesmo do Supabase.
   */
  private async ensureUser(user: SupabaseUser): Promise<string> {
    const email = user.email ?? `${user.id}@sem-email.local`;
    await this.prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email,
        nome: email.split('@')[0],
        telefone: user.phone ?? null,
      },
    });
    return user.id;
  }

  async list(user: SupabaseUser) {
    const imoveis = await this.prisma.property.findMany({
      where: { userId: user.id, ativo: true },
      orderBy: { nome: 'asc' },
      include: incluir,
    });
    return imoveis.map((p) => this.toDTO(p));
  }

  async findOne(user: SupabaseUser, id: string) {
    const imovel = await this.prisma.property.findFirst({
      where: { id, userId: user.id },
      include: incluir,
    });
    if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
    return this.toDTO(imovel);
  }

  async create(user: SupabaseUser, input: PropertyInput) {
    const userId = await this.ensureUser(user);
    const imovel = await this.prisma.property.create({
      data: {
        userId,
        nome: input.nome.trim(),
        endereco: input.endereco?.trim() || null,
        capacidade: input.capacidade ?? 2,
        checkinPadrao: input.checkin || '15:00',
        checkoutPadrao: input.checkout || '11:00',
        taxaLimpeza: input.taxaLimpeza ?? 0,
        observacoes: input.observacoes?.trim() || null,
      },
    });
    await this.syncPlatforms(imovel.id, input.plataformas ?? []);
    await this.syncRecurringCosts(imovel.id, input.custosFixos ?? []);
    return this.findOne(user, imovel.id);
  }

  async update(user: SupabaseUser, id: string, input: PropertyInput) {
    await this.assertOwnership(user, id);
    await this.prisma.property.update({
      where: { id },
      data: {
        nome: input.nome.trim(),
        endereco: input.endereco?.trim() || null,
        capacidade: input.capacidade ?? 2,
        checkinPadrao: input.checkin || '15:00',
        checkoutPadrao: input.checkout || '11:00',
        taxaLimpeza: input.taxaLimpeza ?? 0,
        observacoes: input.observacoes?.trim() || null,
      },
    });
    await this.syncPlatforms(id, input.plataformas ?? []);
    await this.syncRecurringCosts(id, input.custosFixos ?? []);
    return this.findOne(user, id);
  }

  async remove(user: SupabaseUser, id: string) {
    await this.assertOwnership(user, id);
    // O onDelete: Cascade do schema remove reservas/custos vinculados.
    await this.prisma.property.delete({ where: { id } });
    return { ok: true };
  }

  // --- auxiliares -------------------------------------------------------

  private async assertOwnership(user: SupabaseUser, id: string) {
    const dono = await this.prisma.property.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!dono) throw new NotFoundException('Imóvel não encontrado.');
  }

  /**
   * Sincroniza os canais de venda do imóvel a partir dos NOMES das plataformas.
   * Cria a Plataforma se ainda não existir e ajusta os vínculos (PropertyListing).
   */
  private async syncPlatforms(propertyId: string, nomes: string[]) {
    const limpos = [...new Set(nomes.map((n) => n.trim()).filter(Boolean))];

    const plataformas = await Promise.all(
      limpos.map((nome) =>
        this.prisma.platform.upsert({
          where: { nome },
          update: {},
          create: { nome },
        }),
      ),
    );
    const desejadas = new Set(plataformas.map((p) => p.id));

    const atuais = await this.prisma.propertyListing.findMany({
      where: { propertyId },
    });
    const atuaisIds = new Set(atuais.map((l) => l.platformId));

    // Remove os vínculos que saíram.
    const remover = atuais
      .filter((l) => !desejadas.has(l.platformId))
      .map((l) => l.id);
    if (remover.length) {
      await this.prisma.propertyListing.deleteMany({
        where: { id: { in: remover } },
      });
    }

    // Cria os vínculos novos.
    for (const p of plataformas) {
      if (!atuaisIds.has(p.id)) {
        await this.prisma.propertyListing.create({
          data: { propertyId, platformId: p.id },
        });
      }
    }
  }

  /**
   * Substitui as linhas de custo fixo do imóvel. Mantém só as com valor > 0
   * (mesma regra do protótipo).
   */
  private async syncRecurringCosts(
    propertyId: string,
    itens: RecurringCostInput[],
  ) {
    await this.prisma.recurringCost.deleteMany({ where: { propertyId } });
    const validos = itens.filter((x) => Number(x.valorMensal) > 0);
    if (validos.length) {
      await this.prisma.recurringCost.createMany({
        data: validos.map((x) => ({
          propertyId,
          categoria: x.categoria,
          valorMensal: x.valorMensal,
        })),
      });
    }
  }

  // Converte o registro do banco no formato que o site espera (espelha o protótipo).
  private toDTO(p: ImovelComRelacoes) {
    return {
      id: p.id,
      nome: p.nome,
      endereco: p.endereco,
      capacidade: p.capacidade,
      checkin: p.checkinPadrao,
      checkout: p.checkoutPadrao,
      taxaLimpeza: Number(p.taxaLimpeza),
      observacoes: p.observacoes,
      plataformas: p.listings.map((l) => l.platform.nome),
      custosFixos: p.recurringCosts.map((c) => ({
        id: c.id,
        categoria: c.categoria,
        valorMensal: Number(c.valorMensal),
      })),
      criadoEm: p.criadoEm,
    };
  }
}
