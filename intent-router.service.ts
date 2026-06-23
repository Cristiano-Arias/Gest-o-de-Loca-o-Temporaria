import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface IntentResult {
  intencao:
    | 'NOVA_RESERVA'
    | 'LANCAR_CUSTO'
    | 'BLOQUEAR'
    | 'CONSULTA_AGENDA'
    | 'CONSULTA_FINANCEIRA'
    | 'CONSULTA_METRICA'
    | 'GERAR_RELATORIO'
    | 'AJUDA'
    | 'DESCONHECIDO';
  campos: Record<string, any>; // campos extraídos (imovel, valor, datas...)
  confianca: number; // 0..1
  faltando: string[]; // campos obrigatórios ausentes
}

/**
 * Classifica a mensagem do operador em uma intenção e extrai os campos.
 * Usa o modelo com saída estruturada (JSON) — sem if/else de palavra-chave.
 */
@Injectable()
export class IntentRouterService {
  private readonly client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  private readonly systemPrompt = `Você é o roteador de um PMS de aluguel por temporada.
Receba a mensagem do operador (português, datas em DD/MM, moeda em R$) e responda
APENAS com um JSON, sem comentários nem markdown, no formato:
{
  "intencao": "<uma das opções>",
  "campos": { ... },          // ex.: imovel, plataforma, hospede, checkin, checkout, valorBruto, taxaLimpeza, categoria, valor, data
  "confianca": 0.0-1.0,
  "faltando": ["campo1", ...] // obrigatórios ausentes para a intenção detectada
}
Datas devem sair no formato ISO (YYYY-MM-DD), assumindo o ano corrente se omitido.
Valores monetários como número (sem "R$").`;

  async route(mensagem: string): Promise<IntentResult> {
    const resp = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: this.systemPrompt,
      messages: [{ role: 'user', content: mensagem }],
    });

    const text = resp.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    try {
      return JSON.parse(text) as IntentResult;
    } catch {
      return {
        intencao: 'DESCONHECIDO',
        campos: {},
        confianca: 0,
        faltando: [],
      };
    }
  }
}
