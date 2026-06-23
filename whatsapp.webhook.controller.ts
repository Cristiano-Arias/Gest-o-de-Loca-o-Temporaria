import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Webhook da Meta WhatsApp Cloud API.
 *
 * GET  -> verificação inicial (hub.challenge) exigida pela Meta.
 * POST -> recebimento de mensagens. Responde 200 em <200ms e delega
 *         o processamento para a fila, garantindo que nada se perca.
 */
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('inbound-messages') private readonly inboundQueue: Queue,
  ) {}

  // --- Verificação do webhook (Meta chama uma vez no setup) ---
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    throw new ForbiddenException('Token de verificação inválido');
  }

  // --- Recebimento de mensagens ---
  @Post()
  @HttpCode(200)
  async receive(@Body() body: any, @Req() req: any): Promise<{ ok: true }> {
    // (Em produção: validar a assinatura X-Hub-Signature-256 antes de confiar.)
    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    const messages = entry?.messages ?? [];

    for (const msg of messages) {
      const from = msg.from; // telefone E.164 sem '+'
      const user = await this.prisma.user.findFirst({
        where: { telefone: { contains: from } },
      });
      if (!user) continue; // remetente não cadastrado: ignora (ou onboarding)

      // 1) Persiste a mensagem CRUA antes de qualquer processamento.
      const stored = await this.prisma.whatsAppMessage.create({
        data: {
          userId: user.id,
          direcao: 'INBOUND',
          conteudo: msg.text?.body ?? null,
          waMessageId: msg.id,
          payloadRaw: msg,
        },
      });

      // 2) Enfileira para processamento assíncrono (intenção / extração).
      await this.inboundQueue.add('process', {
        messageId: stored.id,
        userId: user.id,
        type: msg.type, // text | image | document | ...
      });
    }

    return { ok: true };
  }
}
