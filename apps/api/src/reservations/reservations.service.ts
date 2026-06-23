import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationKind, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseUser } from '../auth/supabase-auth.guard';
import { ReservationInput } from './reservation.dto';

const incluir = {
  property: true,
  guest: true,
  platform: true,
} satisfies Prisma.ReservationInclude;

type ReservaComRelacoes = Prisma.ReservationGetPayload<{
  include: typeof incluir;
}>;

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SupabaseUser, propertyId?: string) {
    const where: Prisma.ReservationWhereInput = {
      property: { userId: user.id },
    };
    if (propertyId) where.propertyId = propertyId;

    const reservas = await this.prisma.reservation.findMany({
      where,
      include: incluir,
      orderBy: { checkin: 'desc' },
    });
    return reservas.map((r) => this.toDTO(r));
  }

  async findOne(user: SupabaseUser, id: string) {
    const reserva = await this.prisma.reservation.findFirst({
      where: { id, property: { userId: user.id } },
      include: incluir,
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada.');
    return this.toDTO(reserva);
  }

  async create(user: SupabaseUser, input: ReservationInput) {
    await this.assertProperty(user, input.propertyId);

    const ci = this.parseDate(input.checkin);
    const co = this.parseDate(input.checkout);
    const noites = this.nights(ci, co);
    if (noites <= 0) {
      throw new BadRequestException(
        'A data final deve ser depois da data inicial.',
      );
    }
    await this.assertNoConflict(input.propertyId, ci, co, null);

    const ehReserva = input.kind === ReservationKind.BOOKING;
    const platformId = ehReserva
      ? await this.resolvePlatform(input.plataforma)
      : null;
    const guestId = ehReserva ? await this.syncGuest(null, input) : null;

    const bruto = ehReserva ? input.valorBruto ?? 0 : 0;
    const taxa = ehReserva ? input.taxaPlataforma ?? 0 : 0;

    const reserva = await this.prisma.reservation.create({
      data: {
        propertyId: input.propertyId,
        kind: input.kind,
        platformId,
        guestId,
        codigoReserva: input.codigo?.trim() || null,
        checkin: ci,
        checkout: co,
        noites,
        hospedes: ehReserva ? input.hospedes ?? 1 : 1,
        valorBruto: bruto,
        taxaPlataforma: taxa,
        taxaLimpeza: ehReserva ? input.taxaLimpeza ?? 0 : 0,
        // Líquido na entrada manual = bruto − taxa da plataforma (regra do protótipo).
        valorLiquido: ehReserva ? bruto - taxa : 0,
        status: ehReserva
          ? input.status ?? ReservationStatus.CONFIRMADA
          : ReservationStatus.BLOQUEADA,
        motivoBloqueio: ehReserva ? null : input.motivo?.trim() || null,
      },
    });
    return this.findOne(user, reserva.id);
  }

  async update(user: SupabaseUser, id: string, input: ReservationInput) {
    const atual = await this.prisma.reservation.findFirst({
      where: { id, property: { userId: user.id } },
    });
    if (!atual) throw new NotFoundException('Reserva não encontrada.');
    await this.assertProperty(user, input.propertyId);

    const ci = this.parseDate(input.checkin);
    const co = this.parseDate(input.checkout);
    const noites = this.nights(ci, co);
    if (noites <= 0) {
      throw new BadRequestException(
        'A data final deve ser depois da data inicial.',
      );
    }
    await this.assertNoConflict(input.propertyId, ci, co, id);

    const ehReserva = input.kind === ReservationKind.BOOKING;
    const platformId = ehReserva
      ? await this.resolvePlatform(input.plataforma)
      : null;
    const guestId = ehReserva
      ? await this.syncGuest(atual.guestId, input)
      : atual.guestId;

    const bruto = ehReserva ? input.valorBruto ?? 0 : 0;
    const taxa = ehReserva ? input.taxaPlataforma ?? 0 : 0;

    await this.prisma.reservation.update({
      where: { id },
      data: {
        propertyId: input.propertyId,
        kind: input.kind,
        platformId,
        guestId,
        codigoReserva: input.codigo?.trim() || null,
        checkin: ci,
        checkout: co,
        noites,
        hospedes: ehReserva ? input.hospedes ?? 1 : 1,
        valorBruto: bruto,
        taxaPlataforma: taxa,
        taxaLimpeza: ehReserva ? input.taxaLimpeza ?? 0 : 0,
        valorLiquido: ehReserva ? bruto - taxa : 0,
        status: ehReserva
          ? input.status ?? ReservationStatus.CONFIRMADA
          : ReservationStatus.BLOQUEADA,
        motivoBloqueio: ehReserva ? null : input.motivo?.trim() || null,
      },
    });
    return this.findOne(user, id);
  }

  async remove(user: SupabaseUser, id: string) {
    const reserva = await this.prisma.reservation.findFirst({
      where: { id, property: { userId: user.id } },
      select: { id: true },
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada.');
    await this.prisma.reservation.delete({ where: { id } });
    return { ok: true };
  }

  // --- auxiliares -------------------------------------------------------

  // Datas chegam como 'AAAA-MM-DD'; fixamos meia-noite UTC para não escorregar de dia.
  private parseDate(s: string): Date {
    return new Date(`${s}T00:00:00.000Z`);
  }

  private nights(ci: Date, co: Date): number {
    return Math.round((co.getTime() - ci.getTime()) / 86_400_000);
  }

  private async assertProperty(user: SupabaseUser, propertyId: string) {
    const dono = await this.prisma.property.findFirst({
      where: { id: propertyId, userId: user.id },
      select: { id: true },
    });
    if (!dono) throw new NotFoundException('Imóvel não encontrado.');
  }

  /**
   * Conflito de datas (mesma regra do protótipo): sobreposição quando
   * checkin < co && checkout > ci, ignorando canceladas e a própria reserva.
   */
  private async assertNoConflict(
    propertyId: string,
    ci: Date,
    co: Date,
    ignoreId: string | null,
  ) {
    const conflito = await this.prisma.reservation.findFirst({
      where: {
        propertyId,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
        status: { not: ReservationStatus.CANCELADA },
        checkin: { lt: co },
        checkout: { gt: ci },
      },
      include: { guest: true },
    });
    if (conflito) {
      const quem =
        conflito.guest?.nome ||
        (conflito.kind === ReservationKind.BLOCK ? 'bloqueio' : 'reserva');
      const curto = (d: Date) =>
        `${String(d.getUTCDate()).padStart(2, '0')}/${String(
          d.getUTCMonth() + 1,
        ).padStart(2, '0')}`;
      throw new ConflictException(
        `Conflito de agenda com ${quem} (${curto(conflito.checkin)}→${curto(
          conflito.checkout,
        )}).`,
      );
    }
  }

  // Acha/cria a plataforma pelo nome e devolve o id (ou null se vazio).
  private async resolvePlatform(nome?: string): Promise<string | null> {
    const limpo = nome?.trim();
    if (!limpo) return null;
    const plataforma = await this.prisma.platform.upsert({
      where: { nome: limpo },
      update: {},
      create: { nome: limpo },
    });
    return plataforma.id;
  }

  /**
   * Mantém o hóspede da reserva: atualiza o existente ou cria um novo quando
   * há nome. Sem nome, conserva o vínculo atual.
   */
  private async syncGuest(
    existingGuestId: string | null,
    input: ReservationInput,
  ): Promise<string | null> {
    const nome = input.hospedeNome?.trim();
    const telefone = input.hospedeTel?.trim() || null;
    if (!nome) return existingGuestId;

    if (existingGuestId) {
      await this.prisma.guest.update({
        where: { id: existingGuestId },
        data: { nome, telefone },
      });
      return existingGuestId;
    }
    const guest = await this.prisma.guest.create({
      data: { nome, telefone },
    });
    return guest.id;
  }

  // Converte o registro do banco no formato que o site espera (espelha o protótipo).
  private toDTO(r: ReservaComRelacoes) {
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    return {
      id: r.id,
      kind: r.kind,
      propertyId: r.propertyId,
      propertyNome: r.property.nome,
      plataforma: r.platform?.nome ?? '',
      hospedeNome: r.guest?.nome ?? '',
      hospedeTel: r.guest?.telefone ?? '',
      codigo: r.codigoReserva ?? '',
      checkin: ymd(r.checkin),
      checkout: ymd(r.checkout),
      noites: r.noites,
      hospedes: r.hospedes,
      valorBruto: Number(r.valorBruto),
      taxaPlataforma: Number(r.taxaPlataforma),
      taxaLimpeza: Number(r.taxaLimpeza),
      valorLiquido: Number(r.valorLiquido),
      status: r.status,
      motivo: r.motivoBloqueio ?? '',
      criadoEm: r.criadoEm,
    };
  }
}
