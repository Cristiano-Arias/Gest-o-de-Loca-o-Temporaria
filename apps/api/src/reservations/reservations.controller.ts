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
import { ReservationsService } from './reservations.service';
import { ReservationInput } from './reservation.dto';
import { SupabaseAuthGuard, SupabaseUser } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Reservas e bloqueios — sempre restritos aos imóveis do próprio usuário.
@Controller('reservations')
@UseGuards(SupabaseAuthGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Get()
  list(
    @CurrentUser() user: SupabaseUser,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.service.list(user, propertyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: SupabaseUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: SupabaseUser, @Body() dto: ReservationInput) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SupabaseUser,
    @Param('id') id: string,
    @Body() dto: ReservationInput,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: SupabaseUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
