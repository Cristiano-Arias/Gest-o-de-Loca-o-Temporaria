import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LeasesService } from './leases.service';
import { InstallmentStatusInput, LeaseInput } from './lease.dto';
import { JwtAuthGuard, AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Contratos de locação de longo prazo — só do próprio usuário (multi-tenant).
@Controller('leases')
@UseGuards(JwtAuthGuard)
export class LeasesController {
  constructor(private readonly service: LeasesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: LeaseInput) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LeaseInput,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  // Marcar uma mensalidade como paga ou reabri-la.
  @Patch(':id/installments/:installmentId')
  setInstallment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('installmentId') installmentId: string,
    @Body() dto: InstallmentStatusInput,
  ) {
    return this.service.setInstallmentStatus(user, id, installmentId, dto);
  }
}
