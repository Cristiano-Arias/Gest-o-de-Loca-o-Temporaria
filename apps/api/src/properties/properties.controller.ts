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
import { PropertiesService } from './properties.service';
import { PropertyInput } from './property.dto';
import { SupabaseAuthGuard, SupabaseUser } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Todas as rotas exigem login e só enxergam os imóveis do próprio usuário.
@Controller('properties')
@UseGuards(SupabaseAuthGuard)
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get()
  list(@CurrentUser() user: SupabaseUser) {
    return this.service.list(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: SupabaseUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: SupabaseUser, @Body() dto: PropertyInput) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SupabaseUser,
    @Param('id') id: string,
    @Body() dto: PropertyInput,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: SupabaseUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
