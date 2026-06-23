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
