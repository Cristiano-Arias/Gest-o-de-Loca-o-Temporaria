import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationKind, ReservationStatus, Prisma } from '@prisma/client';

interface CreateReservationInput {
  propertyId: string;
  kind?: ReservationKind;
  platformId?: string;
  codigoReserva?: string;
  guestId?: string;
  checkin: Date;
  checkout: Date;
  hospedes?: number;
  valorBruto?: number;
  taxaPlataforma?: number;
  taxaLimpeza?: number;
  motivoBloqueio?: string;
}

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria reserva ou bloqueio.
   *  - Calcula noites e valor líquido.
   *  - Bloqueia sobreposição de datas no mesmo imóvel (regra de negócio).
   *  - É idempotente: se (plataforma, código) já existe, ATUALIZA em vez de duplicar.
   */
  async create(input: CreateReservationInput) {
    if (input.checkout <= input.checkin) {
      throw new BadRequestException('Check-out deve ser posterior ao check-in.');
    }

    const noites = this.diffDays(input.checkin, input.checkout);

    // --- Detecção de conflito de agenda ---
    const conflito = await this.findOverlap(
      input.propertyId,
      input.checkin,
      input.checkout,
    );
    if (conflito) {
      throw new ConflictException(
        `Conflito de agenda com a reserva ${conflito.id} ` +
          `(${conflito.checkin.toISOString().slice(0, 10)} → ` +
          `${conflito.checkout.toISOString().slice(0, 10)}).`,
      );
    }

    const valorBruto = input.valorBruto ?? 0;
    const taxaPlataforma = input.taxaPlataforma ?? 0;
    const valorLiquido = valorBruto - taxaPlataforma;

    const kind = input.kind ?? ReservationKind.BOOKING;
    const status =
      kind === ReservationKind.BLOCK
        ? ReservationStatus.BLOQUEADA
        : ReservationStatus.CONFIRMADA;

    const data: Prisma.ReservationUncheckedCreateInput = {
      propertyId: input.propertyId,
      kind,
      platformId: input.platformId,
      codigoReserva: input.codigoReserva,
      guestId: input.guestId,
      checkin: input.checkin,
      checkout: input.checkout,
      noites,
      hospedes: input.hospedes ?? 1,
      valorBruto,
      taxaPlataforma,
      taxaLimpeza: input.taxaLimpeza ?? 0,
      valorLiquido,
      status,
      motivoBloqueio: input.motivoBloqueio,
    };

    // Idempotência por (plataforma, código de reserva)
    if (input.platformId && input.codigoReserva) {
      return this.prisma.reservation.upsert({
        where: {
          platformId_codigoReserva: {
            platformId: input.platformId,
            codigoReserva: input.codigoReserva,
          },
        },
        create: data,
        update: data,
      });
    }

    return this.prisma.reservation.create({ data });
  }

  /** Retorna a primeira reserva/bloqueio que se sobrepõe ao intervalo. */
  private findOverlap(propertyId: string, checkin: Date, checkout: Date) {
    return this.prisma.reservation.findFirst({
      where: {
        propertyId,
        status: {
          in: [
            ReservationStatus.PENDENTE,
            ReservationStatus.CONFIRMADA,
            ReservationStatus.HOSPEDADO,
            ReservationStatus.BLOQUEADA,
          ],
        },
        // sobreposição: existente.checkin < novo.checkout && existente.checkout > novo.checkin
        checkin: { lt: checkout },
        checkout: { gt: checkin },
      },
    });
  }

  private diffDays(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }
}
