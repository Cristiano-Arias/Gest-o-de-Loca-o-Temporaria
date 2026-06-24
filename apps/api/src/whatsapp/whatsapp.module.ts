import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { IntentRouterService } from './intent-router.service';
import { WhatsAppApiService } from './whatsapp-api.service';
import { ImportModule } from '../import/import.module';

@Module({
  imports: [ImportModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, IntentRouterService, WhatsAppApiService],
})
export class WhatsAppModule {}
