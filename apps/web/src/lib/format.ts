// Formata um número como moeda brasileira (R$). Espelha o brl() do protótipo.
export function brl(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// 'AAAA-MM-DD' → 'DD/MM/AAAA' (sem criar Date, evita fuso). Espelha brDate().
export function brDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
