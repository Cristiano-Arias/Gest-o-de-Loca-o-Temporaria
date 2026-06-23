import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { CostCategory } from '@prisma/client';

// Modelo recorrente (RecurringCost): custo fixo mensal de um imóvel, sem dia.
export class RecurringCostInput {
  @IsString()
  propertyId!: string;

  @IsEnum(CostCategory)
  categoria!: CostCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Informe o valor mensal.' })
  valorMensal!: number;
}
