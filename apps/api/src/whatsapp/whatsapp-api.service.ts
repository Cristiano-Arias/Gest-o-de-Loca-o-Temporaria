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

  /**
   * Corrige o "nono dígito" do Brasil. A Meta às vezes entrega o número do
   * remetente sem o 9 (55 + DDD + 8 dígitos = 12). Para enviar/casar com a
   * lista de permitidos, inserimos o 9 após o DDD → 55 + DDD + 9 + 8 = 13.
   */
  private normalizarBR(numero: string): string {
    const d = (numero || '').replace(/\D/g, '');
    if (d.startsWith('55') && d.length === 12) {
      return d.slice(0, 4) + '9' + d.slice(4);
    }
    return d;
  }

  async sendText(to: string, body: string): Promise<void> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const versao = process.env.WHATSAPP_API_VER || 'v21.0';
    const destino = this.normalizarBR(to);

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
          to: destino,
          type: 'text',
          text: { body },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        this.logger.error(`Falha ao enviar WhatsApp (${res.status}): ${txt}`);
      } else {
        this.logger.log(`Resposta enviada para ${destino}.`);
      }
    } catch (e) {
      this.logger.error(`Erro de rede ao enviar WhatsApp: ${String(e)}`);
    }
  }

  /**
   * Baixa um anexo (mídia) recebido. A Meta exige 2 passos:
   *  1) GET /{media_id}      -> devolve a URL temporária do arquivo;
   *  2) GET nessa URL (com o token) -> bytes do arquivo.
   * Retorna o conteúdo como Buffer, ou null em caso de falha.
   */
  async baixarMidia(mediaId: string): Promise<Buffer | null> {
    const token = process.env.WHATSAPP_TOKEN;
    const versao = process.env.WHATSAPP_API_VER || 'v21.0';
    if (!token) {
      this.logger.warn('WHATSAPP_TOKEN ausente — não dá para baixar mídia.');
      return null;
    }
    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/${versao}/${mediaId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!metaRes.ok) {
        this.logger.error(`Falha ao obter URL da mídia (${metaRes.status}).`);
        return null;
      }
      const meta = (await metaRes.json()) as { url?: string };
      if (!meta.url) return null;

      const arqRes = await fetch(meta.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!arqRes.ok) {
        this.logger.error(`Falha ao baixar mídia (${arqRes.status}).`);
        return null;
      }
      const ab = await arqRes.arrayBuffer();
      return Buffer.from(ab);
    } catch (e) {
      this.logger.error(`Erro ao baixar mídia: ${String(e)}`);
      return null;
    }
  }

  /**
   * Inscreve este app nos webhooks da Conta do WhatsApp Business (WABA),
   * para que as mensagens reais sejam entregues ao nosso webhook.
   * Equivale a: POST /{WABA_ID}/subscribed_apps  (com o token do app).
   */
  async subscribeWaba(): Promise<{ ok: boolean; detalhe: string }> {
    const token = process.env.WHATSAPP_TOKEN;
    const waba = process.env.WHATSAPP_WABA_ID;
    const versao = process.env.WHATSAPP_API_VER || 'v21.0';
    if (!token) return { ok: false, detalhe: 'WHATSAPP_TOKEN ausente' };
    if (!waba) return { ok: false, detalhe: 'WHATSAPP_WABA_ID ausente' };

    const url = `https://graph.facebook.com/${versao}/${waba}/subscribed_apps`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const txt = await res.text();
      this.logger.log(`subscribed_apps (${res.status}): ${txt}`);
      return { ok: res.ok, detalhe: `${res.status} ${txt}` };
    } catch (e) {
      this.logger.error(`Erro ao inscrever WABA: ${String(e)}`);
      return { ok: false, detalhe: String(e) };
    }
  }
}
