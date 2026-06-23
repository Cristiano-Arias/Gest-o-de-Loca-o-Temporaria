import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ReservationKind, ReservationStatus } from '@prisma/client';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Dados que o site envia ao criar/editar uma reserva OU um bloqueio.
// Campos espelham o protótipo (pms.html). Em bloqueio, os valores são ignorados.
export class ReservationInput {
  @IsEnum(ReservationKind)
  kind!: ReservationKind; // BOOKING (reserva) | BLOCK (bloqueio)

  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  plataforma?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hospedeNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  hospedeTel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  codigo?: string;

  @Matches(DATA, { message: 'checkin deve estar no formato AAAA-MM-DD' })
  checkin!: string;

  @Matches(DATA, { message: 'checkout deve estar no formato AAAA-MM-DD' })
  checkout!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hospedes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorBruto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxaPlataforma?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxaLimpeza?: number;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string; // motivo do bloqueio
}
