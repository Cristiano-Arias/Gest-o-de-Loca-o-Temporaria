'use client';

// Gráficos leves feitos só com SVG/CSS — sem bibliotecas externas.
// Reproduzem os 4 gráficos do Painel do protótipo.

import { brl, pct } from '@/lib/format';

const PALETA = ['#e07a5f', '#28727c', '#2f9e6f', '#e9a13b', '#5b4486'];

function SemDados() {
  return (
    <div className="flex h-44 items-center justify-center text-sm text-tinta-suave">
      Sem dados ainda
    </div>
  );
}

// Barras verticais (ex.: receita por mês). Valores em moeda.
// `cores` opcional define a cor de cada barra (senão usa a cor do mar).
export function BarrasVerticais({
  labels,
  valores,
  cores,
}: {
  labels: string[];
  valores: number[];
  cores?: string[];
}) {
  const max = Math.max(...valores, 1);
  if (!valores.some((v) => v > 0)) return <SemDados />;
  return (
    <div className="flex h-44 items-end gap-1.5">
      {valores.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              title={brl(v)}
              className={`w-full rounded-t ${cores ? '' : 'bg-mar'}`}
              style={{
                height: `${(v / max) * 100}%`,
                minHeight: v > 0 ? 2 : 0,
                backgroundColor: cores ? cores[i] : undefined,
              }}
            />
          </div>
          <span className="text-[10px] text-tinta-suave">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Barras horizontais (ex.: custos por categoria). Valores em moeda.
export function BarrasHorizontais({
  itens,
}: {
  itens: { label: string; valor: number }[];
}) {
  const max = Math.max(...itens.map((x) => x.valor), 1);
  if (!itens.length) return <SemDados />;
  return (
    <div className="flex h-44 flex-col justify-center gap-2 overflow-y-auto">
      {itens.map((x) => (
        <div key={x.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-tinta-suave" title={x.label}>
            {x.label}
          </span>
          <div className="h-4 flex-1 rounded bg-areia">
            <div
              className="h-4 rounded bg-coral"
              style={{ width: `${(x.valor / max) * 100}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-medium text-tinta">
            {brl(x.valor)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Rosca (doughnut) — receita por plataforma, com legenda.
// `cores` opcional define a cor de cada fatia (senão usa a paleta padrão).
export function Rosca({
  itens,
  cores,
}: {
  itens: { label: string; valor: number }[];
  cores?: string[];
}) {
  const total = itens.reduce((s, x) => s + x.valor, 0);
  if (total <= 0) return <SemDados />;
  const cor = (i: number) => cores?.[i] ?? PALETA[i % PALETA.length];

  const raio = 60;
  const circ = 2 * Math.PI * raio;
  let offset = 0;

  return (
    <div className="flex h-44 items-center gap-4">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
        <g transform="translate(80,80) rotate(-90)">
          {itens.map((x, i) => {
            const frac = x.valor / total;
            const dash = frac * circ;
            const el = (
              <circle
                key={x.label}
                r={raio}
                fill="none"
                stroke={cor(i)}
                strokeWidth={26}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      <div className="flex flex-col gap-1.5 text-xs">
        {itens.map((x, i) => (
          <div key={x.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: cor(i) }}
            />
            <span className="text-tinta">{x.label}</span>
            <span className="text-tinta-suave">
              {pct((x.valor / total) * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Linha/área 0–100% (ocupação por mês).
export function LinhaArea({
  labels,
  valores,
}: {
  labels: string[];
  valores: number[];
}) {
  if (!valores.some((v) => v > 0)) return <SemDados />;
  const W = 320;
  const H = 150;
  const padB = 18;
  const padL = 4;
  const n = valores.length;
  const x = (i: number) => padL + (i * (W - padL * 2)) / Math.max(n - 1, 1);
  const y = (v: number) => H - padB - (v / 100) * (H - padB - 6);

  const pts = valores.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${padL},${H - padB} ${pts} ${x(n - 1)},${H - padB}`;

  return (
    <div className="h-44">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <polygon points={area} fill="rgba(47,158,111,.12)" />
        <polyline
          points={pts}
          fill="none"
          stroke="#2f9e6f"
          strokeWidth={2}
        />
        {valores.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill="#2f9e6f">
            <title>{pct(v)}</title>
          </circle>
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 5}
            textAnchor="middle"
            fontSize={9}
            fill="#4c6a70"
          >
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Cartão que envolve um gráfico com título.
export function CartaoGrafico({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-carias border border-borda bg-superficie p-5 shadow-carias">
      <h3 className="mb-3 font-display text-base font-semibold text-tinta">
        {titulo}
      </h3>
      {children}
    </div>
  );
}
