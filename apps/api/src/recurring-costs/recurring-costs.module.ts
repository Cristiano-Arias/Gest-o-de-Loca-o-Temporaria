import { Module } from '@nestjs/common';
import { RecurringCostsController } from './recurring-costs.controller';
import { RecurringCostsService } from './recurring-costs.service';

@Module({
  controllers: [RecurringCostsController],
  providers: [RecurringCostsService],
})
export class RecurringCostsModule {}
