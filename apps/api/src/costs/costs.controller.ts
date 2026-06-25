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
import { CostInput, LancarFixosInput, MarcarStatusInput } from './cost.dto';
import { JwtAuthGuard, AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('costs')
@UseGuards(JwtAuthGuard)
export class CostsController {
  constructor(private readonly service: CostsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('propertyId') propertyId?: string,
    @Query('categoria') categoria?: CostCategory,
    @Query('statusPagamento') statusPagamento?: PaymentStatus,
  ) {
    return this.service.list(user, { propertyId, categoria, statusPagamento });
  }

  // Lança os custos fixos do mês (idempotente). Vem antes de :id por clareza.
  @Post('lancar-fixos')
  lancarFixos(@CurrentUser() user: AuthUser, @Body() dto: LancarFixosInput) {
    return this.service.lancarFixos(user, dto.propertyId, dto.mes);
  }

  // Marca vários custos com um status (ex.: todos pagos). Antes de :id.
  @Post('marcar-status')
  marcarStatus(@CurrentUser() user: AuthUser, @Body() dto: MarcarStatusInput) {
    return this.service.marcarStatus(user, dto.ids, dto.statusPagamento);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CostInput) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CostInput,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
