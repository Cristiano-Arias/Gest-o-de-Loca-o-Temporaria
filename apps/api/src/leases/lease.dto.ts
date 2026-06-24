import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RentStatus } from '@prisma/client';

// Dados que o site envia ao criar/editar um contrato de longo prazo.
export class LeaseInput {
  @IsString()
  propertyId!: string;

  @IsString()
  @MaxLength(200)
  inquilinoNome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  inquilinoTelefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inquilinoEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  inquilinoDocumento?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorMensal!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outrosCustos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  outrosCustosDescricao?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  diaVencimento!: number;

  // Datas no formato AAAA-MM-DD.
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inicio!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fim?: string;

  @IsOptional()
  @IsBoolean()
  incluiInternet?: boolean;

  @IsOptional()
  @IsBoolean()
  incluiAgua?: boolean;

  @IsOptional()
  @IsBoolean()
  incluiEnergia?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}

// Atualização do status de uma mensalidade (marcar pago / reabrir).
export class InstallmentStatusInput {
  @IsEnum(RentStatus)
  status!: RentStatus; // PAGO ou EM_ABERTO

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  pagoEm?: string;
}
