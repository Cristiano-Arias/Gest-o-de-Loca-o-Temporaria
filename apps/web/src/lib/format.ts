// Formata um número como moeda brasileira (R$). Espelha o brl() do protótipo.
export function brl(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
