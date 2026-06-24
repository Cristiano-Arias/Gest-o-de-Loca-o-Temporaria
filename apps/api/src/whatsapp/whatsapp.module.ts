import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { IntentRouterService } from './intent-router.service';
import { WhatsAppApiService } from './whatsapp-api.service';

@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService, IntentRouterService, WhatsAppApiService],
})
export class WhatsAppModule {}
