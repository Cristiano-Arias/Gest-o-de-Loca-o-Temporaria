import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationKind, ReservationStatus } from '@prisma/client';

interface Period {
  from: Date;
  to: Date;
}

/**
 * Núcleo de BI: receita, lucro e métricas de hotelaria (ocupação, ADR, RevPAR).
 * Métricas NÃO são armazenadas — calculadas sob demanda a partir das reservas/custos.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async financialSummary(userId: string, period: Period) {
    const reservas = await this.prisma.reservation.findMany({
      where: {
        property: { userId },
        kind: ReservationKind.BOOKING,
        status: { not: ReservationStatus.CANCELADA },
        checkin: { lte: period.to },
        checkout: { gte: period.from },
      },
    });

    const custos = await this.prisma.cost.aggregate({
      where: {
        property: { userId },
        data: { gte: period.from, lte: period.to },
      },
      _sum: { valor: true },
    });

    const receitaBruta = reservas.reduce((s, r) => s + Number(r.valorBruto), 0);
    const receitaLiquida = reservas.reduce(
      (s, r) => s + Number(r.valorLiquido),
      0,
    );
    const custosTotais = Number(custos._sum.valor ?? 0);
    const lucroLiquido = receitaLiquida - custosTotais;
    const margem = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

    return {
      receitaBruta,
      receitaLiquida,
      custosTotais,
      lucroLiquido,
      margem: Number(margem.toFixed(2)),
      numeroReservas: reservas.length,
    };
  }

  async occupancyMetrics(userId: string, period: Period) {
    const numImoveis = await this.prisma.property.count({
      where: { userId, ativo: true },
    });
    const dias = this.diffDays(period.from, period.to) + 1;
    const noitesDisponiveis = numImoveis * dias;

    const reservas = await this.prisma.reservation.findMany({
      where: {
        property: { userId },
        kind: ReservationKind.BOOKING,
        status: { not: ReservationStatus.CANCELADA },
        checkin: { lte: period.to },
        checkout: { gte: period.from },
      },
    });

    // Noites vendidas, recortadas ao período consultado.
    const noitesVendidas = reservas.reduce((sum, r) => {
      const ini = r.checkin > period.from ? r.checkin : period.from;
      const fim = r.checkout < period.to ? r.checkout : period.to;
      return sum + Math.max(0, this.diffDays(ini, fim));
    }, 0);

    const receitaHospedagem = reservas.reduce(
      (s, r) => s + Number(r.valorBruto),
      0,
    );

    const ocupacao =
      noitesDisponiveis > 0 ? (noitesVendidas / noitesDisponiveis) * 100 : 0;
    const adr = noitesVendidas > 0 ? receitaHospedagem / noitesVendidas : 0;
    const revpar =
      noitesDisponiveis > 0 ? receitaHospedagem / noitesDisponiveis : 0;
    const ticketMedio =
      reservas.length > 0 ? receitaHospedagem / reservas.length : 0;
    const estadiaMedia =
      reservas.length > 0
        ? reservas.reduce((s, r) => s + r.noites, 0) / reservas.length
        : 0;

    return {
      noitesDisponiveis,
      noitesVendidas,
      ocupacao: Number(ocupacao.toFixed(2)),
      adr: Number(adr.toFixed(2)),
      revpar: Number(revpar.toFixed(2)),
      ticketMedio: Number(ticketMedio.toFixed(2)),
      estadiaMedia: Number(estadiaMedia.toFixed(1)),
    };
  }

  private diffDays(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
  }
}
