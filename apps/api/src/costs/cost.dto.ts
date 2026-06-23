import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { CostCategory, PaymentStatus } from '@prisma/client';

const MES = /^\d{4}-\d{2}$/;

// Lançamento de custo. Custo é por MÊS de referência (sem dia) — decisão do protótipo.
export class CostInput {
  @IsString()
  propertyId!: string;

  @Matches(MES, { message: 'mes deve estar no formato AAAA-MM' })
  mes!: string;

  @IsEnum(CostCategory)
  categoria!: CostCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Informe um valor maior que zero.' })
  valor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descricao?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  statusPagamento?: PaymentStatus;
}

// Pedido para materializar os custos fixos (recorrentes) de um mês.
export class LancarFixosInput {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @Matches(MES, { message: 'mes deve estar no formato AAAA-MM' })
  mes?: string;
}
