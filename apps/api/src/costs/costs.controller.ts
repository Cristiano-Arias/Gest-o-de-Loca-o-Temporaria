import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CostCategory, PaymentStatus } from '@prisma/client';
import { CostsService } from './costs.service';
import { CostInput, LancarFixosInput } from './cost.dto';
import { SupabaseAuthGuard, SupabaseUser } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('costs')
@UseGuards(SupabaseAuthGuard)
export class CostsController {
  constructor(private readonly service: CostsService) {}

  @Get()
  list(
    @CurrentUser() user: SupabaseUser,
    @Query('propertyId') propertyId?: string,
    @Query('categoria') categoria?: CostCategory,
    @Query('statusPagamento') statusPagamento?: PaymentStatus,
  ) {
    return this.service.list(user, { propertyId, categoria, statusPagamento });
  }

  // Lança os custos fixos do mês (idempotente). Vem antes de :id por clareza.
  @Post('lancar-fixos')
  lancarFixos(@CurrentUser() user: SupabaseUser, @Body() dto: LancarFixosInput) {
    return this.service.lancarFixos(user, dto.propertyId, dto.mes);
  }

  @Post()
  create(@CurrentUser() user: SupabaseUser, @Body() dto: CostInput) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SupabaseUser,
    @Param('id') id: string,
    @Body() dto: CostInput,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: SupabaseUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
