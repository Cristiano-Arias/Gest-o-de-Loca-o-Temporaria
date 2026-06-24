import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

/**
 * Webhook da WhatsApp Cloud API (Meta).
 *  GET  -> verificação inicial exigida pela Meta (hub.challenge).
 *  POST -> recebimento de mensagens. Responde 200 na hora e processa em seguida.
 */
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(private readonly service: WhatsAppService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && token && token === esperado) {
      return challenge;
    }
    throw new ForbiddenException('Token de verificação inválido');
  }

  @Post()
  @HttpCode(200)
  receive(@Body() body: any): { ok: true } {
    try {
      const value = body?.entry?.[0]?.changes?.[0]?.value;
      const mensagens = value?.messages ?? [];
      for (const msg of mensagens) {
        if (msg?.type === 'text' && msg?.text?.body && msg?.from) {
          // Não esperamos terminar: respondemos 200 rápido e processamos depois.
          void this.service.processarTexto(msg.from, msg.text.body);
        }
      }
    } catch {
      // Nunca falhar o webhook — a Meta reenviaria e duplicaria.
    }
    return { ok: true };
  }
}
