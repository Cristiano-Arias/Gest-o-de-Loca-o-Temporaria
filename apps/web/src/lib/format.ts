// Formata um número como moeda brasileira (R$). Espelha o brl() do protótipo.
export function brl(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Moeda compacta sem centavos (para eixos de gráfico): 1234 -> "1.234".
export function brlc(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Percentual com uma casa: 12.34 -> "12,3%". Espelha pct() do protótipo.
export function pct(n: number | null | undefined): string {
  return (
    (Number(n) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '%'
  );
}

// Número com uma casa decimal (ex.: estadia média).
export function dec1(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  });
}

// 'AAAA-MM-DD' → 'DD/MM/AAAA' (sem criar Date, evita fuso). Espelha brDate().
export function brDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

// 'AAAA-MM' (ou 'AAAA-MM-DD') → 'jun/2026'. Espelha brMesAno() do protótipo.
export function brMesAno(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m] = iso.split('-');
  return `${MESES_ABREV[Number(m) - 1] ?? m}/${a}`;
}
