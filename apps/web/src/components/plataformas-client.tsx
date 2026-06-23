'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brl, pct, dec1 } from '@/lib/format';
import { Rosca, BarrasVerticais, CartaoGrafico } from '@/components/charts';
import {
  type ReservaMetrica,
  type ImovelMetrica,
  type PeriodoSel,
  type MetricasPlataforma,
  periodoRange,
  plataformasPresentes,
  metricasPlataforma,
  COR_PLAT,
} from '@/lib/metrics';

const PERIODOS: { v: PeriodoSel; l: string }[] = [
  { v: 'mes', l: 'Mês' },
  { v: '30', l: '30d' },
  { v: '90', l: '90d' },
  { v: '365', l: '12m' },
  { v: 'ano', l: 'Ano' },
  { v: 'tudo', l: 'Desde o início' },
];

const cor = (plat: string) => COR_PLAT[plat] ?? '#888888';

export function PlataformasClient() {
  const [imoveis, setImoveis] = useState<ImovelMetrica[]>([]);
  const [reservas, setReservas] = useState<ReservaMetrica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState<PeriodoSel>('30');
  const [filtroImovel, setFiltroImovel] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [imv, res] = await Promise.all([
        api.get<ImovelMetrica[]>('/properties'),
        api.get<ReservaMetrica[]>('/reservations'),
      ]);
      setImoveis(imv);
      setReservas(res);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar as plataformas. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const plats = useMemo(
    () => plataformasPresentes(reservas, filtroImovel),
    [reservas, filtroImovel],
  );

  const dados = useMemo<MetricasPlataforma[]>(() => {
    const [ini, fim] = periodoRange(periodo, reservas, []);
    return plats.map((p) =>
      metricasPlataforma(reservas, p, filtroImovel, ini, fim),
    );
  }, [plats, periodo, reservas, filtroImovel]);

  const totalLiq = useMemo(
    () => dados.reduce((s, x) => s + x.liquida, 0) || 1,
    [dados],
  );

  const semImoveis = !carregando && !erro && imoveis.length === 0;
  const semReservas = !carregando && !erro && !semImoveis && plats.length === 0;

  return (
    <AppShell
      atual="plataformas"
      titulo="Plataformas"
      subtitulo="KPIs comparativos por canal de venda"
      acao={
        !semImoveis && imoveis.length > 1 ? (
          <select
            value={filtroImovel}
            onChange={(e) => setFiltroImovel(e.target.value)}
            className="rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta"
          >
            <option value="">Todos os imóveis</option>
            {imoveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      {erro ? (
        <div className="rounded-carias border border-borda bg-superficie p-5">
          <p className="text-tinta">{erro}</p>
          <button
            onClick={carregar}
            className="mt-3 rounded-lg border border-borda-forte px-3 py-2 text-sm font-medium text-tinta hover:bg-areia"
          >
            Tentar de novo
          </button>
        </div>
      ) : semImoveis || semReservas ? (
        <div className="rounded-carias border border-dashed border-borda-forte bg-superficie p-10 text-center">
          <h3 className="font-display text-xl font-semibold text-tinta">
            {semImoveis ? 'Sem dados ainda' : 'Nenhuma reserva ainda'}
          </h3>
          <p className="mt-1 text-tinta-suave">
            {semImoveis
              ? 'Cadastre reservas para ver os KPIs por plataforma.'
              : 'Lance reservas para comparar os canais (Airbnb, Booking, Direto).'}
          </p>
        </div>
      ) : (
        <>
          {/* seletor de período */}
          <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-borda bg-superficie p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriodo(p.v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  periodo === p.v
                    ? 'bg-mar text-white'
                    : 'text-tinta-suave hover:bg-areia'
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>

          {/* blocos por plataforma */}
          <div className="mb-6 grid grid-cols-1 gap-4">
            {dados.map((x) => (
              <BlocoPlataforma
                key={x.plat}
                x={x}
                participacao={(x.liquida / totalLiq) * 100}
              />
            ))}
          </div>

          {/* comparativo */}
          <h3 className="mb-2 font-display text-lg font-semibold text-tinta">
            Comparativo
          </h3>
          <div className="overflow-x-auto rounded-carias border border-borda bg-superficie shadow-carias">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-xs uppercase tracking-wide text-tinta-suave">
                  <th className="px-4 py-3 text-left font-medium">Plataforma</th>
                  {['Reservas', 'Noites', 'Rec. bruta', 'Comissão', 'Rec. líq.', 'ADR', 'Ticket', 'Cancel.'].map(
                    (c) => (
                      <th key={c} className="px-4 py-3 text-right font-medium">
                        {c}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {dados.map((x) => (
                  <tr key={x.plat} className="border-b border-borda last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-semibold text-tinta">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cor(x.plat) }}
                        />
                        {x.plat}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{x.reservas}</td>
                    <td className="px-4 py-2.5 text-right">{x.noites}</td>
                    <td className="px-4 py-2.5 text-right">{brl(x.bruta)}</td>
                    <td className="px-4 py-2.5 text-right">{brl(x.comissao)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-tinta">
                      {brl(x.liquida)}
                    </td>
                    <td className="px-4 py-2.5 text-right">{brl(x.adr)}</td>
                    <td className="px-4 py-2.5 text-right">{brl(x.ticket)}</td>
                    <td className="px-4 py-2.5 text-right">{x.cancel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-tinta-suave">
            Comissão = valor pago à plataforma. No Airbnb o relatório traz só o
            líquido (Ganhos), então a comissão aparece como zero e o bruto =
            líquido.
          </p>

          {/* gráficos */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CartaoGrafico titulo="Receita líquida por plataforma">
              <Rosca
                itens={dados.map((x) => ({ label: x.plat, valor: x.liquida }))}
                cores={dados.map((x) => cor(x.plat))}
              />
            </CartaoGrafico>
            <CartaoGrafico titulo="Diária média (ADR) por plataforma">
              <BarrasVerticais
                labels={dados.map((x) => x.plat)}
                valores={dados.map((x) => x.adr)}
                cores={dados.map((x) => cor(x.plat))}
              />
            </CartaoGrafico>
          </div>
        </>
      )}
    </AppShell>
  );
}

// --- subcomponentes ----------------------------------------------------

function BlocoPlataforma({
  x,
  participacao,
}: {
  x: MetricasPlataforma;
  participacao: number;
}) {
  const c = cor(x.plat);
  return (
    <div
      className="rounded-carias border border-borda bg-superficie p-5 shadow-carias"
      style={{ borderTop: `4px solid ${c}` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-tinta">
          {x.plat}
        </h3>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: `${c}22`, color: c }}
        >
          {pct(participacao)} da receita
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat
          rotulo="Receita líquida"
          valor={brl(x.liquida)}
          nota={`bruto ${brl(x.bruta)}`}
        />
        <Stat
          rotulo="Comissão paga"
          valor={brl(x.comissao)}
          nota={`taxa efetiva ${pct(x.taxaEf)}`}
        />
        <Stat
          rotulo="Reservas"
          valor={String(x.reservas)}
          nota={`${x.noites} noites`}
        />
        <Stat rotulo="Diária média (ADR)" valor={brl(x.adr)} nota="" />
        <Stat rotulo="Ticket médio" valor={brl(x.ticket)} nota="" />
        <Stat
          rotulo="Estadia média"
          valor={`${dec1(x.estadia)} noites`}
          nota=""
        />
        <Stat
          rotulo="Cancelamentos"
          valor={String(x.cancel)}
          nota={`taxa ${pct(x.taxaCancel)}`}
        />
      </div>
    </div>
  );
}

function Stat({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-tinta-suave">{rotulo}</div>
      <div className="mt-0.5 font-display text-xl font-semibold text-tinta">
        {valor}
      </div>
      <div className="text-xs text-tinta-suave">{nota || ' '}</div>
    </div>
  );
}
