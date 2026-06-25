'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brl, pct, dec1 } from '@/lib/format';
import { catLabel } from '@/lib/constants';
import {
  BarrasVerticais,
  BarrasHorizontais,
  Rosca,
  LinhaArea,
  CartaoGrafico,
} from '@/components/charts';
import {
  type ReservaMetrica,
  type CustoMetrica,
  type ImovelMetrica,
  type PeriodoSel,
  periodoRange,
  calcMetricas,
  calcFutura,
  receitaPorSituacao,
  anosComDados,
  ranking,
  ultimos12,
  receitaPorMes,
  receitaPorPlataforma,
  custosPorCategoria,
  ocupacaoPorMes,
} from '@/lib/metrics';

const PERIODOS: { v: PeriodoSel; l: string }[] = [
  { v: 'mes', l: 'Mês' },
  { v: '30', l: '30d' },
  { v: '90', l: '90d' },
  { v: '365', l: '12m' },
  { v: 'ano', l: 'Ano' },
  { v: 'tudo', l: 'Desde o início' },
];

export function PainelClient() {
  const [imoveis, setImoveis] = useState<ImovelMetrica[]>([]);
  const [reservas, setReservas] = useState<ReservaMetrica[]>([]);
  const [custos, setCustos] = useState<CustoMetrica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState<PeriodoSel>('30');
  const [filtroImovel, setFiltroImovel] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [imv, res, cst] = await Promise.all([
        api.get<ImovelMetrica[]>('/properties'),
        api.get<ReservaMetrica[]>('/reservations'),
        api.get<CustoMetrica[]>('/costs'),
      ]);
      setImoveis(imv);
      setReservas(res);
      setCustos(cst);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar o painel. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // --- métricas do período ---

  const m = useMemo(() => {
    const [ini, fim] = periodoRange(periodo, reservas, custos);
    const base = calcMetricas(
      reservas,
      custos,
      imoveis.length,
      filtroImovel,
      ini,
      fim,
    );
    return {
      ...base,
      futura: calcFutura(reservas, filtroImovel),
      situacao: receitaPorSituacao(reservas, filtroImovel, ini, fim),
    };
  }, [periodo, reservas, custos, imoveis, filtroImovel]);

  const rankingDados = useMemo(
    () => ranking(reservas, custos, imoveis, filtroImovel),
    [reservas, custos, imoveis, filtroImovel],
  );
  const temRanking = rankingDados.some((x) => x.res > 0);

  const anos = useMemo(
    () => anosComDados(reservas, custos, filtroImovel),
    [reservas, custos, filtroImovel],
  );

  const linhasAno = useMemo(
    () =>
      anos.map((ano) => ({
        ano,
        m: calcMetricas(
          reservas,
          custos,
          imoveis.length,
          filtroImovel,
          new Date(ano, 0, 1),
          new Date(ano, 11, 31),
        ),
      })),
    [anos, reservas, custos, imoveis, filtroImovel],
  );

  // --- séries dos gráficos ---

  const meses = useMemo(() => ultimos12(), []);
  const serieReceita = useMemo(
    () => receitaPorMes(reservas, filtroImovel, meses),
    [reservas, filtroImovel, meses],
  );
  const seriePlataforma = useMemo(
    () => receitaPorPlataforma(reservas, filtroImovel),
    [reservas, filtroImovel],
  );
  const serieCustos = useMemo(
    () =>
      custosPorCategoria(custos, filtroImovel).map((x) => ({
        label: catLabel(x.categoria),
        valor: x.valor,
      })),
    [custos, filtroImovel],
  );
  const serieOcup = useMemo(
    () => ocupacaoPorMes(reservas, imoveis.length, filtroImovel, meses),
    [reservas, imoveis.length, filtroImovel, meses],
  );

  // --- render ---

  const semImoveis = !carregando && !erro && imoveis.length === 0;
  const labels = meses.map((x) => x.label);

  return (
    <AppShell
      atual="painel"
      titulo="Painel"
      subtitulo="Indicadores do seu negócio"
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
      ) : semImoveis ? (
        <div className="rounded-carias border border-dashed border-borda-forte bg-superficie p-10 text-center">
          <h3 className="font-display text-xl font-semibold text-tinta">
            Bem-vindo ao C. Arias
          </h3>
          <p className="mt-1 text-tinta-suave">
            Cadastre um imóvel e lance algumas reservas para ver seus números
            aqui.
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

          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              rotulo="Receita líquida"
              valor={brl(m.receitaLiquida)}
              nota={`bruto ${brl(m.receitaBruta)}`}
            />
            <Kpi
              rotulo="Custos"
              valor={brl(m.custos)}
              nota={`${m.custosLancamentos} lançamento(s)`}
            />
            <Kpi
              rotulo="Lucro"
              valor={brl(m.lucro)}
              nota={`margem ${pct(m.margem)}`}
              cor={m.lucro >= 0 ? 'pos' : 'neg'}
            />
            <Kpi
              rotulo="Ocupação"
              valor={pct(m.ocup)}
              nota={`${m.noitesVend} noites vendidas`}
            />
            <Kpi rotulo="Diária média (ADR)" valor={brl(m.adr)} nota="" />
            <Kpi
              rotulo="RevPAR"
              valor={brl(m.revpar)}
              nota="receita por noite disponível"
            />
            <Kpi
              rotulo="Ticket médio"
              valor={brl(m.ticket)}
              nota={`${m.nReservas} reserva(s)`}
            />
            <Kpi
              rotulo="Receita futura"
              valor={brl(m.futura)}
              nota="reservas a partir de hoje"
            />
          </div>

          {/* receita líquida por situação */}
          <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SituacaoCard
              cor="#2f9e6f"
              rotulo="Concluída"
              valor={brl(m.situacao.concluida)}
              nota="hospedagens finalizadas"
            />
            <SituacaoCard
              cor="#28727c"
              rotulo="Em andamento"
              valor={brl(m.situacao.andamento)}
              nota="hóspede na casa agora"
            />
            <SituacaoCard
              cor="#e9a13b"
              rotulo="Futura"
              valor={brl(m.situacao.futura)}
              nota="confirmadas, a realizar"
            />
          </div>
          <p className="mb-6 text-xs text-tinta-suave">
            Os indicadores acima consideram todas as reservas do período, exceto
            canceladas. Esta faixa mostra quanto já se realizou e quanto ainda
            está por vir (os três somam a Receita líquida).
          </p>

          {/* ranking de imóveis */}
          {temRanking ? (
            <Secao titulo="Ranking de imóveis">
              <Tabela
                cabecalho={[
                  'Imóvel',
                  'Reservas',
                  'Noites',
                  'Receita líq.',
                  'Lucro',
                ]}
                alinhar={['l', 'r', 'r', 'r', 'r']}
              >
                {rankingDados.map((x) => (
                  <tr
                    key={x.nome}
                    className="border-b border-borda last:border-0"
                  >
                    <td className="px-2.5 py-2 font-semibold text-tinta">
                      {x.nome}
                    </td>
                    <td className="px-2.5 py-2 text-right">{x.res}</td>
                    <td className="px-2.5 py-2 text-right">{x.noites}</td>
                    <td className="px-2.5 py-2 text-right">{brl(x.rec)}</td>
                    <td
                      className={`px-2.5 py-2 text-right font-medium ${
                        x.lucro >= 0 ? 'text-verde' : 'text-vermelho'
                      }`}
                    >
                      {brl(x.lucro)}
                    </td>
                  </tr>
                ))}
              </Tabela>
            </Secao>
          ) : null}

          {/* desempenho por ano */}
          {linhasAno.length ? (
            <Secao titulo="Desempenho por ano">
              <Tabela
                cabecalho={[
                  'Ano',
                  'Reservas',
                  'Noites',
                  'Ocup.',
                  'Rec. bruta',
                  'Rec. líq.',
                  'Custos',
                  'Lucro',
                  'Margem',
                  'ADR',
                  'RevPAR',
                  'Ticket',
                  'Estadia',
                ]}
                alinhar={[
                  'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r',
                ]}
              >
                {linhasAno.map(({ ano, m: a }) => (
                  <tr key={ano} className="border-b border-borda last:border-0">
                    <td className="px-2.5 py-2 font-semibold text-tinta">
                      {ano}
                    </td>
                    <td className="px-2.5 py-2 text-right">{a.nReservas}</td>
                    <td className="px-2.5 py-2 text-right">{a.noitesVend}</td>
                    <td className="px-2.5 py-2 text-right">{pct(a.ocup)}</td>
                    <td className="px-2.5 py-2 text-right">
                      {brl(a.receitaBruta)}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      {brl(a.receitaLiquida)}
                    </td>
                    <td className="px-2.5 py-2 text-right">{brl(a.custos)}</td>
                    <td
                      className={`px-2.5 py-2 text-right ${
                        a.lucro >= 0 ? 'text-verde' : 'text-vermelho'
                      }`}
                    >
                      {brl(a.lucro)}
                    </td>
                    <td className="px-2.5 py-2 text-right">{pct(a.margem)}</td>
                    <td className="px-2.5 py-2 text-right">{brl(a.adr)}</td>
                    <td className="px-2.5 py-2 text-right">{brl(a.revpar)}</td>
                    <td className="px-2.5 py-2 text-right">{brl(a.ticket)}</td>
                    <td className="px-2.5 py-2 text-right">{dec1(a.estadia)}</td>
                  </tr>
                ))}
              </Tabela>
              <p className="mt-2 text-xs text-tinta-suave">
                Receita líquida já com a comissão do Booking descontada; no
                Airbnb usa os ganhos líquidos do anfitrião.
              </p>
            </Secao>
          ) : null}

          {/* gráficos */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CartaoGrafico titulo="Receita por mês — por check-out (12 meses)">
              <BarrasVerticais
                labels={labels}
                valores={serieReceita}
                mostrarValores
                tendencia
              />
            </CartaoGrafico>
            <CartaoGrafico titulo="Receita por plataforma">
              <Rosca
                itens={seriePlataforma.map((x) => ({
                  label: x.label,
                  valor: x.valor,
                }))}
              />
            </CartaoGrafico>
            <CartaoGrafico titulo="Custos por categoria">
              <BarrasHorizontais itens={serieCustos} />
            </CartaoGrafico>
            <CartaoGrafico titulo="Ocupação por mês">
              <LinhaArea labels={labels} valores={serieOcup} />
            </CartaoGrafico>
          </div>
        </>
      )}
    </AppShell>
  );
}

// --- subcomponentes ----------------------------------------------------

function Kpi({
  rotulo,
  valor,
  nota,
  cor,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  cor?: 'pos' | 'neg';
}) {
  const corValor =
    cor === 'pos' ? 'text-verde' : cor === 'neg' ? 'text-vermelho' : 'text-tinta';
  return (
    <div className="rounded-carias border border-borda bg-superficie p-4 shadow-carias">
      <div className="text-xs font-medium text-tinta-suave">{rotulo}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${corValor}`}>
        {valor}
      </div>
      <div className="mt-0.5 text-xs text-tinta-suave">{nota || ' '}</div>
    </div>
  );
}

// Quadro da faixa "Receita líquida por situação", com faixa colorida no topo.
function SituacaoCard({
  cor,
  rotulo,
  valor,
  nota,
}: {
  cor: string;
  rotulo: string;
  valor: string;
  nota: string;
}) {
  return (
    <div
      className="rounded-carias border border-borda bg-superficie p-4 shadow-carias"
      style={{ borderTop: `4px solid ${cor}` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: cor }}
        />
        <span className="text-xs font-medium text-tinta-suave">{rotulo}</span>
      </div>
      <div className="mt-1 font-display text-2xl font-semibold text-tinta">
        {valor}
      </div>
      <div className="mt-0.5 text-xs text-tinta-suave">{nota}</div>
    </div>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 font-display text-lg font-semibold text-tinta">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Tabela({
  cabecalho,
  alinhar,
  children,
}: {
  cabecalho: string[];
  alinhar: ('l' | 'r')[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-carias border border-borda bg-superficie shadow-carias">
      <table className="w-full whitespace-nowrap text-[13px] tabular-nums">
        <thead>
          <tr className="border-b border-borda text-[10px] uppercase tracking-wide text-tinta-suave">
            {cabecalho.map((c, i) => (
              <th
                key={c}
                className={`px-2.5 py-2.5 font-medium ${
                  alinhar[i] === 'r' ? 'text-right' : 'text-left'
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
