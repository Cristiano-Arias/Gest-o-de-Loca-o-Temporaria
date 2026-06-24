import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
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
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly service: WhatsAppService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
    this.logger.log('Webhook GET (verificação) recebido da Meta.');
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
      const statuses = value?.statuses ?? [];
      // Log de chegada — confirma que a Meta está entregando o webhook.
      this.logger.log(
        `Webhook POST recebido: ${mensagens.length} mensagem(ns), ${statuses.length} status(es).`,
      );
      for (const msg of mensagens) {
        if (!msg?.from) continue;
        this.logger.log(`Mensagem de ${msg.from}, tipo=${msg.type}`);
        // Não esperamos terminar: respondemos 200 rápido e processamos depois.
        if (msg.type === 'text' && msg.text?.body) {
          void this.service.processarTexto(msg.from, msg.text.body);
        } else if (msg.type === 'document' && msg.document) {
          void this.service.processarDocumento(msg.from, msg.document);
        }
      }
    } catch (e) {
      // Nunca falhar o webhook — a Meta reenviaria e duplicaria.
      this.logger.error(`Erro no webhook POST: ${String(e)}`);
    }
    return { ok: true };
  }
}
