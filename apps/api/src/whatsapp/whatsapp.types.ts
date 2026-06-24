// Tipos do roteador de intenção do WhatsApp.

export type Intencao =
  | 'LANCAR_CUSTO'
  | 'CONSULTA_AGENDA'
  | 'CONSULTA_FINANCEIRA'
  | 'AJUDA'
  | 'DESCONHECIDO';

export interface IntentResult {
  intencao: Intencao;
  // Campos extraídos para a intenção (ex.: categoria, valor, imovel, competencia).
  campos: {
    categoria?: string; // um dos CostCategory (ENERGIA, AGUA, GAS, ...)
    valor?: number; // número, sem "R$"
    imovel?: string; // nome/apelido do imóvel falado
    competencia?: string; // 'AAAA-MM' (mês de referência)
    descricao?: string;
  };
  confianca: number; // 0..1
  faltando: string[]; // campos obrigatórios ausentes
}
