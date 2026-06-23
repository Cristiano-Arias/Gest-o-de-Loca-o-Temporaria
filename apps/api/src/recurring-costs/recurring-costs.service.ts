import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseUser } from '../auth/supabase-auth.guard';
import { RecurringCostInput } from './recurring-cost.dto';

const MARCA_FIXO = 'Custo fixo mensal';

@Injectable()
export class RecurringCostsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista todos os custos fixos do usuário (achatados por imóvel), marcando
   * se já foram lançados no mês informado (status "Lançado no mês").
   */
  async list(user: SupabaseUser, mes?: string) {
    const ym = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : this.mesAtual();
    const data = new Date(`${ym}-01T00:00:00.000Z`);

    const fixos = await this.prisma.recurringCost.findMany({
      where: { property: { userId: user.id } },
      include: { property: true },
      orderBy: [{ property: { nome: 'asc' } }, { categoria: 'asc' }],
    });

    // Custos já lançados neste mês marcados como custo fixo.
    const lancados = await this.prisma.cost.findMany({
      where: {
        property: { userId: user.id },
        data,
        descricao: MARCA_FIXO,
      },
      select: { propertyId: true, categoria: true },
    });
    const chave = (pid: string, cat: string) => `${pid}|${cat}`;
    const jaLancado = new Set(lancados.map((c) => chave(c.propertyId, c.categoria)));

    return fixos.map((f) => ({
      id: f.id,
      propertyId: f.propertyId,
      propertyNome: f.property.nome,
      categoria: f.categoria,
      valorMensal: Number(f.valorMensal),
      lancadoNoMes: jaLancado.has(chave(f.propertyId, f.categoria)),
    }));
  }

  async create(user: SupabaseUser, input: RecurringCostInput) {
    await this.assertProperty(user, input.propertyId);
    const fixo = await this.prisma.recurringCost.create({
      data: {
        propertyId: input.propertyId,
        categoria: input.categoria,
        valorMensal: input.valorMensal,
      },
    });
    return { id: fixo.id };
  }

  async update(user: SupabaseUser, id: string, input: RecurringCostInput) {
    await this.assertOwnership(user, id);
    await this.assertProperty(user, input.propertyId);
    await this.prisma.recurringCost.update({
      where: { id },
      data: {
        propertyId: input.propertyId,
        categoria: input.categoria,
        valorMensal: input.valorMensal,
      },
    });
    return { id };
  }

  async remove(user: SupabaseUser, id: string) {
    await this.assertOwnership(user, id);
    await this.prisma.recurringCost.delete({ where: { id } });
    return { ok: true };
  }

  // --- auxiliares -------------------------------------------------------

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
    const fixo = await this.prisma.recurringCost.findFirst({
      where: { id, property: { userId: user.id } },
      select: { id: true },
    });
    if (!fixo) throw new NotFoundException('Custo fixo não encontrado.');
  }
}
