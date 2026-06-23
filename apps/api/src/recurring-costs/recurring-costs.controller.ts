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
import { RecurringCostsService } from './recurring-costs.service';
import { RecurringCostInput } from './recurring-cost.dto';
import { SupabaseAuthGuard, SupabaseUser } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('recurring-costs')
@UseGuards(SupabaseAuthGuard)
export class RecurringCostsController {
  constructor(private readonly service: RecurringCostsService) {}

  @Get()
  list(@CurrentUser() user: SupabaseUser, @Query('mes') mes?: string) {
    return this.service.list(user, mes);
  }

  @Post()
  create(@CurrentUser() user: SupabaseUser, @Body() dto: RecurringCostInput) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SupabaseUser,
    @Param('id') id: string,
    @Body() dto: RecurringCostInput,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: SupabaseUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
