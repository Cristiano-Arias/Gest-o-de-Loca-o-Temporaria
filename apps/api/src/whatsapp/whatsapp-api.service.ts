import { Injectable, Logger } from '@nestjs/common';

/**
 * Envia mensagens de texto pela WhatsApp Cloud API (Meta).
 * Usa as variáveis de ambiente:
 *   WHATSAPP_TOKEN     - token de acesso permanente do app
 *   WHATSAPP_PHONE_ID  - ID do número de telefone (Phone Number ID)
 *   WHATSAPP_API_VER   - versão da Graph API (opcional, padrão v21.0)
 */
@Injectable()
export class WhatsAppApiService {
  private readonly logger = new Logger(WhatsAppApiService.name);

  async sendText(to: string, body: string): Promise<void> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const versao = process.env.WHATSAPP_API_VER || 'v21.0';

    if (!token || !phoneId) {
      this.logger.warn(
        'WHATSAPP_TOKEN/WHATSAPP_PHONE_ID ausentes — resposta não enviada.',
      );
      return;
    }

    const url = `https://graph.facebook.com/${versao}/${phoneId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        this.logger.error(`Falha ao enviar WhatsApp (${res.status}): ${txt}`);
      }
    } catch (e) {
      this.logger.error(`Erro de rede ao enviar WhatsApp: ${String(e)}`);
    }
  }
}
