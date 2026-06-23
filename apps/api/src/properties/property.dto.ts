import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CostCategory } from '@prisma/client';

// Uma linha de custo fixo mensal do imóvel (sem dia de vencimento — decisão do protótipo).
export class RecurringCostInput {
  @IsEnum(CostCategory)
  categoria!: CostCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorMensal!: number;
}

// Dados que o site envia ao criar/editar um imóvel.
// Os nomes dos campos espelham o protótipo (pms.html) para facilitar a paridade.
export class PropertyInput {
  @IsString()
  @MaxLength(200)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  endereco?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacidade?: number;

  @IsOptional()
  @IsString()
  checkin?: string; // HH:mm

  @IsOptional()
  @IsString()
  checkout?: string; // HH:mm

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxaLimpeza?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  plataformas?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringCostInput)
  custosFixos?: RecurringCostInput[];
}
