'use client';

// Gráficos leves feitos só com SVG/CSS — sem bibliotecas externas.
// Reproduzem os 4 gráficos do Painel do protótipo, com acabamento visual
// cuidado (grade, gradientes) e interatividade (tooltip ao passar o mouse).

import { useState } from 'react';
import { brl, pct, brlCompacto } from '@/lib/format';

const PALETA = ['#e07a5f', '#28727c', '#2f9e6f', '#e9a13b', '#5b4486'];

function SemDados() {
  return (
    <div className="flex h-44 items-center justify-center text-sm text-tinta-suave">
      Sem dados ainda
    </div>
  );
}

// Balãozinho (tooltip) que segue o cursor dentro do gráfico.
function Tip({
  pos,
  children,
}: {
  pos: { x: number; y: number } | null;
  children: React.ReactNode;
}) {
  if (!pos) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-tinta px-2 py-1 text-xs font-medium text-white shadow-carias"
      style={{ left: pos.x, top: pos.y - 8 }}
    >
      {children}
    </div>
  );
}

// Posição do cursor relativa ao container (para posicionar o tooltip).
function posRelativa(
  e: React.MouseEvent<HTMLDivElement>,
): { x: number; y: number } {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Barras verticais em SVG (ex.: receita por mês), com tooltip e destaque.
export function BarrasVerticais({
  labels,
  valores,
  cores,
  mostrarValores,
  tendencia,
}: {
  labels: string[];
  valores: number[];
  cores?: string[];
  mostrarValores?: boolean;
  tendencia?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  if (!valores.some((v) => v > 0)) return <SemDados />;
  const max = Math.max(...valores, 1);
  const W = 360;
  const H = 188;
  const padT = 18;
  const padB = 22;
  const padX = 8;
  const n = valores.length;
  const slot = (W - padX * 2) / n;
  const barW = Math.min(slot * 0.6, 34);
  const area = H - padT - padB;
  const cx = (i: number) => padX + slot * i + slot / 2;
  const alturaBarra = (v: number) => (v / max) * area;
  const topo = (v: number) => padT + (area - alturaBarra(v));
  const grades = [0.25, 0.5, 0.75, 1].map((f) => padT + area - f * area);

  let pontosTendencia = '';
  if (tendencia && n > 1) {
    const sx = valores.reduce((a, _v, i) => a + i, 0);
    const sy = valores.reduce((a, v) => a + v, 0);
    const sxy = valores.reduce((a, v, i) => a + i * v, 0);
    const sxx = valores.reduce((a, _v, i) => a + i * i, 0);
    const den = n * sxx - sx * sx;
    const slope = den !== 0 ? (n * sxy - sx * sy) / den : 0;
    const intercept = (sy - slope * sx) / n;
    const yLinha = (i: number) => {
      const val = Math.max(0, Math.min(max, intercept + slope * i));
      return padT + (area - (val / max) * area);
    };
    pontosTendencia = `${cx(0)},${yLinha(0)} ${cx(n - 1)},${yLinha(n - 1)}`;
  }

  return (
    <div
      className="relative h-44"
      onMouseMove={(e) => setPos(posRelativa(e))}
      onMouseLeave={() => {
        setHover(null);
        setPos(null);
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <defs>
          <linearGradient id="grad-barra" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a93a0" />
            <stop offset="100%" stopColor="#28727c" />
          </linearGradient>
        </defs>

        {grades.map((y, i) => (
          <line
            key={i}
            x1={padX}
            y1={y}
            x2={W - padX}
            y2={y}
            stroke="#eef2f2"
            strokeWidth={1}
          />
        ))}

        {valores.map((v, i) => (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            style={{ cursor: 'pointer' }}
          >
            {/* área sensível ao mouse (cobre o slot todo) */}
            <rect
              x={padX + slot * i}
              y={padT}
              width={slot}
              height={area}
              fill="transparent"
            />
            {v > 0 ? (
              <rect
                x={cx(i) - barW / 2}
                y={topo(v)}
                width={barW}
                height={alturaBarra(v)}
                rx={3}
                fill={cores ? cores[i] : 'url(#grad-barra)'}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            ) : null}
            {mostrarValores && v > 0 ? (
              <text
                x={cx(i)}
                y={topo(v) - 4}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fill="#3a5b61"
              >
                {brlCompacto(v)}
              </text>
            ) : null}
            <text
              x={cx(i)}
              y={H - 7}
              textAnchor="middle"
              fontSize={9}
              fill={hover === i ? '#2a4348' : '#7c9499'}
              fontWeight={hover === i ? 700 : 400}
            >
              {labels[i]}
            </text>
          </g>
        ))}

        {tendencia && pontosTendencia ? (
          <polyline
            points={pontosTendencia}
            fill="none"
            stroke="#e07a5f"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      {hover !== null ? (
        <Tip pos={pos}>
          {labels[hover]}: {brl(valores[hover])}
        </Tip>
      ) : null}
    </div>
  );
}

// Barras horizontais (ex.: custos por categoria). Valores em moeda.
export function BarrasHorizontais({
  itens,
}: {
  itens: { label: string; valor: number }[];
}) {
  const total = itens.reduce((s, x) => s + x.valor, 0) || 1;
  const max = Math.max(...itens.map((x) => x.valor), 1);
  if (!itens.length) return <SemDados />;
  return (
    <div className="flex h-44 flex-col justify-center gap-1.5 overflow-y-auto pr-1">
      {itens.map((x) => (
        <div
          key={x.label}
          className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition hover:bg-areia/50"
          title={`${x.label}: ${brl(x.valor)} (${pct((x.valor / total) * 100)})`}
        >
          <span
            className="w-24 shrink-0 truncate text-tinta-suave"
            title={x.label}
          >
            {x.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-areia">
            <div
              className="h-4 rounded-full"
              style={{
                width: `${Math.max((x.valor / max) * 100, 3)}%`,
                background: 'linear-gradient(90deg,#f0936f,#e07a5f)',
              }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-semibold text-tinta tabular-nums">
            {brl(x.valor)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Rosca (doughnut) com total no centro, legenda e destaque/tooltip por fatia.
export function Rosca({
  itens,
  cores,
}: {
  itens: { label: string; valor: number }[];
  cores?: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const total = itens.reduce((s, x) => s + x.valor, 0);
  if (total <= 0) return <SemDados />;
  const cor = (i: number) => cores?.[i] ?? PALETA[i % PALETA.length];

  const raio = 60;
  const circ = 2 * Math.PI * raio;
  let offset = 0;

  return (
    <div
      className="relative flex h-44 items-center gap-4"
      onMouseMove={(e) => setPos(posRelativa(e))}
      onMouseLeave={() => {
        setHover(null);
        setPos(null);
      }}
    >
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
                strokeWidth={hover === i ? 28 : 24}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                opacity={hover === null || hover === i ? 1 : 0.45}
                onMouseEnter={() => setHover(i)}
                style={{ cursor: 'pointer' }}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x="80" y="76" textAnchor="middle" fontSize="10" fill="#7c9499">
          {hover === null ? 'total' : itens[hover].label}
        </text>
        <text
          x="80"
          y="92"
          textAnchor="middle"
          fontSize="13"
          fontWeight={700}
          fill="#2a4348"
        >
          {brlCompacto(hover === null ? total : itens[hover].valor)}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 text-xs">
        {itens.map((x, i) => (
          <div
            key={x.label}
            className="flex cursor-pointer items-center gap-2"
            onMouseEnter={() => setHover(i)}
            style={{ opacity: hover === null || hover === i ? 1 : 0.5 }}
          >
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: cor(i) }}
            />
            <span className="text-tinta">{x.label}</span>
            <span className="text-tinta-suave tabular-nums">
              {pct((x.valor / total) * 100)}
            </span>
          </div>
        ))}
      </div>

      {hover !== null ? (
        <Tip pos={pos}>
          {itens[hover].label}: {brl(itens[hover].valor)} ·{' '}
          {pct((itens[hover].valor / total) * 100)}
        </Tip>
      ) : null}
    </div>
  );
}

// Linha/área 0–100% (ocupação por mês), com grade, eixo e pontos interativos.
export function LinhaArea({
  labels,
  valores,
}: {
  labels: string[];
  valores: number[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  if (!valores.some((v) => v > 0)) return <SemDados />;
  const W = 340;
  const H = 160;
  const padB = 20;
  const padL = 22;
  const padR = 6;
  const padT = 8;
  const n = valores.length;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(n - 1, 1);
  const y = (v: number) => padT + (1 - v / 100) * (H - padB - padT);

  const pts = valores.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${x(0)},${H - padB} ${pts} ${x(n - 1)},${H - padB}`;
  const grades = [0, 25, 50, 75, 100];
  const passo = (W - padL - padR) / Math.max(n - 1, 1);

  return (
    <div
      className="relative h-44"
      onMouseMove={(e) => setPos(posRelativa(e))}
      onMouseLeave={() => {
        setHover(null);
        setPos(null);
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <defs>
          <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(47,158,111,.28)" />
            <stop offset="100%" stopColor="rgba(47,158,111,.02)" />
          </linearGradient>
        </defs>

        {grades.map((g) => (
          <g key={g}>
            <line
              x1={padL}
              y1={y(g)}
              x2={W - padR}
              y2={y(g)}
              stroke="#eef2f2"
              strokeWidth={1}
            />
            <text
              x={padL - 4}
              y={y(g) + 3}
              textAnchor="end"
              fontSize={8}
              fill="#9fb2b6"
            >
              {g}
            </text>
          </g>
        ))}

        <polygon points={area} fill="url(#grad-area)" />
        <polyline
          points={pts}
          fill="none"
          stroke="#2f9e6f"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {valores.map((v, i) => (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={x(i) - passo / 2}
              y={padT}
              width={passo}
              height={H - padB - padT}
              fill="transparent"
            />
            <circle
              cx={x(i)}
              cy={y(v)}
              r={hover === i ? 4 : 2.5}
              fill="#2f9e6f"
            />
          </g>
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize={9}
            fill={hover === i ? '#2a4348' : '#7c9499'}
            fontWeight={hover === i ? 700 : 400}
          >
            {l}
          </text>
        ))}
      </svg>

      {hover !== null ? (
        <Tip pos={pos}>
          {labels[hover]}: {pct(valores[hover])}
        </Tip>
      ) : null}
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
