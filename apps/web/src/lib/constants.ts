// Plataformas (canais de venda) — espelha PLATAFORMAS do protótipo.
export const PLATAFORMAS = ['Airbnb', 'Booking.com', 'Direto', 'Outra'] as const;

// Categorias de custo — os valores batem com o enum CostCategory do banco.
export const CATEGORIAS: { value: string; label: string }[] = [
  { value: 'LIMPEZA', label: 'Limpeza' },
  { value: 'CONDOMINIO', label: 'Condomínio' },
  { value: 'IPTU', label: 'IPTU' },
  { value: 'ENERGIA', label: 'Energia' },
  { value: 'AGUA', label: 'Água' },
  { value: 'GAS', label: 'Gás' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'COMPRAS', label: 'Compras' },
  { value: 'REPOSICAO_ITENS', label: 'Reposição de itens' },
  { value: 'LAVANDERIA', label: 'Lavanderia' },
  { value: 'TAXAS_BANCARIAS', label: 'Taxas bancárias' },
  { value: 'OUTROS', label: 'Outros' },
];

export function catLabel(value: string): string {
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}

// Status possíveis de uma reserva (espelha STATUS do protótipo).
export const STATUS = [
  'PENDENTE',
  'CONFIRMADA',
  'HOSPEDADO',
  'FINALIZADA',
  'CANCELADA',
] as const;

// Primeira letra maiúscula, resto minúsculo: "CONFIRMADA" → "Confirmada".
export function statusLabel(value: string): string {
  if (!value) return '—';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

// Status de pagamento de um custo (espelha PAGOS do protótipo).
export const PAGOS = ['PENDENTE', 'PAGO', 'ATRASADO'] as const;

// Tipo de uso do imóvel: temporada (diárias) ou longo prazo (aluguel mensal).
export const TIPOS_IMOVEL: { value: string; label: string }[] = [
  { value: 'TEMPORADA', label: 'Temporada (diárias)' },
  { value: 'LONGO_PRAZO', label: 'Longo prazo (aluguel mensal)' },
];

export function tipoImovelLabel(value: string): string {
  return TIPOS_IMOVEL.find((t) => t.value === value)?.label ?? 'Temporada';
}

// Situação de uma mensalidade de aluguel.
export function situacaoAluguelLabel(value: string): string {
  if (value === 'PAGO') return 'Pago';
  if (value === 'ATRASADO') return 'Atrasado';
  if (value === 'EM_ABERTO') return 'Em aberto';
  return value;
}
