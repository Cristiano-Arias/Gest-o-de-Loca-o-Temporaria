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
import { JwtAuthGuard, AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('recurring-costs')
@UseGuards(JwtAuthGuard)
export class RecurringCostsController {
  constructor(private readonly service: RecurringCostsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('mes') mes?: string) {
    return this.service.list(user, mes);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: RecurringCostInput) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RecurringCostInput,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
