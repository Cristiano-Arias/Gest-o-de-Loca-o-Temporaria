import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { IntentResult } from './whatsapp.types';

// Mês atual em 'AAAA-MM' (horário do servidor) — usado como referência para a IA.
function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Classifica a mensagem do operador (texto livre, em português) numa intenção e
 * extrai os campos. Usa o modelo da Anthropic com saída em JSON.
 *
 * Modelo configurável por ANTHROPIC_MODEL (padrão: claude-opus-4-8).
 */
@Injectable()
export class IntentRouterService {
  private readonly logger = new Logger(IntentRouterService.name);
  private cliente: Anthropic | null = null;
  private readonly model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

  // Cria o cliente só quando há chave — evita derrubar a API se ANTHROPIC_API_KEY
  // ainda não estiver configurada no ambiente.
  private obterCliente(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    if (!this.cliente) {
      this.cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.cliente;
  }

  private systemPrompt(): string {
    return `Você é o roteador de um sistema de gestão de aluguéis (português do Brasil).
Receba a mensagem do operador e responda APENAS com um JSON válido, sem markdown e sem comentários, no formato:
{
  "intencao": "LANCAR_CUSTO" | "CONSULTA_AGENDA" | "CONSULTA_FINANCEIRA" | "AJUDA" | "DESCONHECIDO",
  "campos": {
    "categoria": "<uma das opções de categoria, em maiúsculas>",
    "valor": <número, sem "R$">,
    "imovel": "<nome ou apelido do imóvel citado, se houver>",
    "competencia": "<AAAA-MM do mês de referência>",
    "descricao": "<texto livre opcional>"
  },
  "confianca": <0.0 a 1.0>,
  "faltando": ["<campos obrigatórios ausentes>"]
}

Regras:
- Para LANCAR_CUSTO os campos obrigatórios são "categoria" e "valor".
- "categoria" deve ser exatamente uma destas: LIMPEZA, CONDOMINIO, IPTU, ENERGIA, AGUA, GAS, INTERNET, MANUTENCAO, COMPRAS, REPOSICAO_ITENS, LAVANDERIA, TAXAS_BANCARIAS, OUTROS. Mapeie sinônimos (luz->ENERGIA, água/conta de água->AGUA, gás->GAS, faxina/diarista->LIMPEZA, wifi->INTERNET, conserto->MANUTENCAO). Se não encaixar, use OUTROS.
- "valor" é numérico. "R$ 120,50" vira 120.5; "120" vira 120.
- "competencia" no formato AAAA-MM. Se o mês não for citado, use o mês atual (${mesAtual()}). "julho" do ano corrente vira AAAA-07.
- Inclua "imovel" apenas se a mensagem citar um imóvel.
- Se a mensagem for pergunta sobre agenda/check-ins use CONSULTA_AGENDA; sobre dinheiro/receita/lucro use CONSULTA_FINANCEIRA; pedido de ajuda use AJUDA; caso não entenda, DESCONHECIDO.`;
  }

  async route(mensagem: string): Promise<IntentResult> {
    const client = this.obterCliente();
    if (!client) {
      this.logger.warn('ANTHROPIC_API_KEY ausente — roteador desativado.');
      return { intencao: 'DESCONHECIDO', campos: {}, confianca: 0, faltando: [] };
    }
    try {
      const resp = await client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: this.systemPrompt(),
        messages: [{ role: 'user', content: mensagem }],
      });

      const texto = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .replace(/```json|```/g, '')
        .trim();

      const json = JSON.parse(texto) as IntentResult;
      // Garante formato mínimo.
      return {
        intencao: json.intencao ?? 'DESCONHECIDO',
        campos: json.campos ?? {},
        confianca: typeof json.confianca === 'number' ? json.confianca : 0,
        faltando: Array.isArray(json.faltando) ? json.faltando : [],
      };
    } catch (e) {
      this.logger.error(`Falha no roteador de intenção: ${String(e)}`);
      return {
        intencao: 'DESCONHECIDO',
        campos: {},
        confianca: 0,
        faltando: [],
      };
    }
  }
}
