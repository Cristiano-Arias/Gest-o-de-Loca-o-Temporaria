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
  tabelaPorMes,
  futuroPorMes,
  plataformasPresentes,
  dataBR,
} from '@/lib/metrics';

const MES_NOME = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const PERIODOS: { v: PeriodoSel; l: string }[] = [
  { v: 'mes', l: 'Este mês' },
  { v: '30', l: 'Últimos 30 dias' },
  { v: '90', l: 'Últimos 90 dias' },
  { v: '365', l: 'Últimos 12 meses' },
  { v: 'ano', l: 'Este ano' },
  { v: 'tudo', l: 'Desde o início' },
];

export function PainelClient() {
  const [imoveis, setImoveis] = useState<ImovelMetrica[]>([]);
  const [reservas, setReservas] = useState<ReservaMetrica[]>([]);
  const [custos, setCustos] = useState<CustoMetrica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState<PeriodoSel>('mes');
  const [filtroImovel, setFiltroImovel] = useState('');
  const [filtroPlataforma, setFiltroPlataforma] = useState('');

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

  // Canais existentes nas reservas, para o seletor do topo.
  const plataformas = useMemo(
    () => plataformasPresentes(reservas, ''),
    [reservas],
  );

  // O filtro de plataforma é aplicado uma vez aqui: todo o resto da tela
  // trabalha sobre estas listas.
  const reservasVis = useMemo(
    () =>
      filtroPlataforma
        ? reservas.filter((r) => (r.plataforma || 'Outra') === filtroPlataforma)
        : reservas,
    [reservas, filtroPlataforma],
  );

  /**
   * Custos NÃO são lançados por plataforma — condomínio, energia e limpeza são
   * do imóvel, não do canal. Com um canal selecionado, somar os custos inteiros
   * contra a receita de um canal só daria um lucro falso; então os custos saem
   * da conta e a tela mostra "—" em custo, lucro e margem.
   */
  const custosVis = useMemo(
    () => (filtroPlataforma ? [] : custos),
    [custos, filtroPlataforma],
  );
  const semCustos = filtroPlataforma !== '';

  const m = useMemo(() => {
    const [ini, fim] = periodoRange(periodo, reservasVis, custosVis);
    const base = calcMetricas(
      reservasVis,
      custosVis,
      imoveis.length,
      filtroImovel,
      ini,
      fim,
    );
    return {
      ...base,
      futura: calcFutura(reservasVis, filtroImovel),
      situacao: receitaPorSituacao(reservasVis, filtroImovel, ini, fim),
      ini,
      fim,
    };
  }, [periodo, reservasVis, custosVis, imoveis, filtroImovel]);

  const linhasMes = useMemo(
    () =>
      tabelaPorMes(
        reservasVis,
        custosVis,
        imoveis.length,
        filtroImovel,
        m.ini,
        m.fim,
      ),
    [reservasVis, custosVis, imoveis, filtroImovel, m.ini, m.fim],
  );

  // Reservas já contratadas que ainda não começaram, por mês de check-in.
  // Não depende do período escolhido: futuro é futuro.
  const futuros = useMemo(
    () => futuroPorMes(reservasVis, filtroImovel),
    [reservasVis, filtroImovel],
  );

  const canaisFuturo = useMemo(() => {
    const set = new Set<string>();
    for (const l of futuros) for (const c of Object.keys(l.porPlataforma)) set.add(c);
    const ordem = ['Airbnb', 'Booking.com', 'Direto', 'Outra'];
    return [...set].sort((a, b) => {
      const ia = ordem.indexOf(a);
      const ib = ordem.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [futuros]);

  // Canais que aparecem na tabela mensal (colunas de quantidade por plataforma).
  const canais = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhasMes) {
      for (const c of Object.keys(l.porPlataforma)) set.add(c);
    }
    const ordem = ['Airbnb', 'Booking.com', 'Direto', 'Outra'];
    return [...set].sort((a, b) => {
      const ia = ordem.indexOf(a);
      const ib = ordem.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [linhasMes]);

  const rankingDados = useMemo(
    () => ranking(reservasVis, custosVis, imoveis, filtroImovel),
    [reservasVis, custosVis, imoveis, filtroImovel],
  );
  const temRanking = rankingDados.some((x) => x.res > 0);

  const anos = useMemo(
    () => anosComDados(reservasVis, custosVis, filtroImovel),
    [reservasVis, custosVis, filtroImovel],
  );

  const linhasAno = useMemo(
    () =>
      anos.map((ano) => ({
        ano,
        m: calcMetricas(
          reservasVis,
          custosVis,
          imoveis.length,
          filtroImovel,
          new Date(ano, 0, 1),
          new Date(ano, 11, 31),
        ),
      })),
    [anos, reservasVis, custosVis, imoveis, filtroImovel],
  );

  // --- séries dos gráficos ---

  const meses = useMemo(() => ultimos12(), []);
  const serieReceita = useMemo(
    () => receitaPorMes(reservasVis, filtroImovel, meses),
    [reservasVis, filtroImovel, meses],
  );
  const seriePlataforma = useMemo(
    () => receitaPorPlataforma(reservasVis, filtroImovel),
    [reservasVis, filtroImovel],
  );
  const serieCustos = useMemo(
    () =>
      custosPorCategoria(custosVis, filtroImovel).map((x) => ({
        label: catLabel(x.categoria),
        valor: x.valor,
      })),
    [custosVis, filtroImovel],
  );
  const serieOcup = useMemo(
    () => ocupacaoPorMes(reservasVis, imoveis.length, filtroImovel, meses),
    [reservasVis, imoveis.length, filtroImovel, meses],
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
        !semImoveis ? (
          <div className="flex flex-wrap gap-2">
            {imoveis.length > 1 ? (
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
            ) : null}
            {plataformas.length > 1 ? (
              <select
                value={filtroPlataforma}
                onChange={(e) => setFiltroPlataforma(e.target.value)}
                className="rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta"
              >
                <option value="">Todas as plataformas</option>
                {plataformas.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
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
          {semCustos ? (
            <p className="-mt-3 mb-3 rounded-lg border border-ambar/40 bg-ambar/10 px-3 py-2 text-xs text-tinta">
              Filtrando por <strong>{filtroPlataforma}</strong>. Custos (condomínio,
              energia, limpeza…) são do imóvel, não do canal — por isso custo, lucro
              e margem aparecem como “—”. Receita, noites, ocupação e diárias seguem
              valendo para o canal escolhido.
            </p>
          ) : null}
          <p className="-mt-3 mb-5 text-xs text-tinta-suave">
            Mostrando de <strong>{dataBR(m.ini)}</strong> a{' '}
            <strong>{dataBR(m.fim)}</strong>.{' '}
            {periodo === 'mes' || periodo === 'ano'
              ? 'Inclui dias que ainda não chegaram — a faixa colorida abaixo separa o que já se realizou.'
              : periodo === 'tudo'
                ? 'Da reserva mais antiga à mais distante.'
                : 'Janela para trás: só o que já aconteceu. O que está por vir aparece em “Receita futura”.'}
          </p>

          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              rotulo="Receita líquida"
              valor={brl(m.receitaLiquida)}
              nota={`bruto ${brl(m.receitaBruta)}`}
            />
            <Kpi
              rotulo="Custos"
              valor={semCustos ? '—' : brl(m.custos)}
              nota={
                semCustos
                  ? 'não separável por canal'
                  : `${m.custosLancamentos} lançamento(s)`
              }
            />
            <Kpi
              rotulo="Lucro"
              valor={semCustos ? '—' : brl(m.lucro)}
              nota={semCustos ? 'não separável por canal' : `margem ${pct(m.margem)}`}
              cor={semCustos ? undefined : m.lucro >= 0 ? 'pos' : 'neg'}
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

          {/* reservas futuras, mês a mês */}
          {futuros.length ? (
            <Secao titulo="Reservas futuras contratadas, mês a mês">
              <Tabela
                cabecalho={[
                  'Mês de entrada',
                  'Reservas',
                  ...canaisFuturo,
                  'Noites',
                  'Receita líquida',
                ]}
                alinhar={[
                  'l',
                  'r',
                  ...canaisFuturo.map(() => 'r' as const),
                  'r',
                  'r',
                ]}
              >
                {futuros.map((l) => (
                  <tr key={l.chave} className="border-b border-borda last:border-0">
                    <td className="whitespace-nowrap px-2.5 py-2 font-semibold text-tinta">
                      {MES_NOME[l.mes]}/{l.ano}
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold">
                      {l.reservas}
                    </td>
                    {canaisFuturo.map((c) => (
                      <td key={c} className="px-2.5 py-2 text-right text-tinta-suave">
                        {l.porPlataforma[c] ?? 0}
                      </td>
                    ))}
                    <td className="px-2.5 py-2 text-right">{l.noites}</td>
                    <td className="px-2.5 py-2 text-right font-semibold text-mar">
                      {brl(l.receitaLiquida)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-borda-forte bg-areia/50">
                  <td className="px-2.5 py-2 font-semibold text-tinta">Total</td>
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {futuros.reduce((s, l) => s + l.reservas, 0)}
                  </td>
                  {canaisFuturo.map((c) => (
                    <td key={c} className="px-2.5 py-2 text-right font-semibold">
                      {futuros.reduce((s, l) => s + (l.porPlataforma[c] ?? 0), 0)}
                    </td>
                  ))}
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {futuros.reduce((s, l) => s + l.noites, 0)}
                  </td>
                  <td className="px-2.5 py-2 text-right font-semibold text-mar">
                    {brl(futuros.reduce((s, l) => s + l.receitaLiquida, 0))}
                  </td>
                </tr>
              </Tabela>
              <p className="mt-2 text-xs text-tinta-suave">
                Só o que já está contratado e ainda não começou, pelo mês de{' '}
                <strong>check-in</strong>. O total bate com o cartão “Receita
                futura” lá em cima. Não muda com o período escolhido.
              </p>
            </Secao>
          ) : null}

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

          {/* desempenho mês a mês */}
          {linhasMes.length ? (
            <Secao titulo="Desempenho mês a mês">
              <Tabela
                cabecalho={[
                  'Mês',
                  'Reservas',
                  ...canais,
                  'Noites',
                  'Estadia',
                  'Ocupação',
                  'Rec. líq.',
                  'Comissão',
                  'Custos',
                  'Lucro',
                ]}
                alinhar={[
                  'l',
                  'r',
                  ...canais.map(() => 'r' as const),
                  'r', 'r', 'r', 'r', 'r', 'r', 'r',
                ]}
              >
                {linhasMes.map((l) => (
                  <tr key={l.chave} className="border-b border-borda last:border-0">
                    <td className="whitespace-nowrap px-2.5 py-2 font-semibold text-tinta">
                      {MES_NOME[l.mes]}/{l.ano}
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold">
                      {l.reservas}
                    </td>
                    {canais.map((c) => (
                      <td key={c} className="px-2.5 py-2 text-right text-tinta-suave">
                        {l.porPlataforma[c] ?? 0}
                      </td>
                    ))}
                    <td className="px-2.5 py-2 text-right">{l.noites}</td>
                    <td className="px-2.5 py-2 text-right">{dec1(l.estadia)}</td>
                    <td className="px-2.5 py-2 text-right">{pct(l.ocup)}</td>
                    <td className="px-2.5 py-2 text-right">
                      {brl(l.receitaLiquida)}
                    </td>
                    <td className="px-2.5 py-2 text-right text-tinta-suave">
                      {brl(l.comissao)}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      {semCustos ? '—' : brl(l.custos)}
                    </td>
                    <td
                      className={`px-2.5 py-2 text-right font-semibold ${
                        semCustos
                          ? 'text-tinta-suave'
                          : l.lucro >= 0
                            ? 'text-verde'
                            : 'text-vermelho'
                      }`}
                    >
                      {semCustos ? '—' : brl(l.lucro)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-borda-forte bg-areia/50">
                  <td className="whitespace-nowrap px-2.5 py-2 font-semibold text-tinta">
                    Total fechado
                  </td>
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {linhasMes.reduce((s, l) => s + l.reservas, 0)}
                  </td>
                  {canais.map((c) => (
                    <td key={c} className="px-2.5 py-2 text-right font-semibold">
                      {linhasMes.reduce((s, l) => s + (l.porPlataforma[c] ?? 0), 0)}
                    </td>
                  ))}
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {linhasMes.reduce((s, l) => s + l.noites, 0)}
                  </td>
                  <td className="px-2.5 py-2 text-right">—</td>
                  <td className="px-2.5 py-2 text-right">—</td>
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {brl(linhasMes.reduce((s, l) => s + l.receitaLiquida, 0))}
                  </td>
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {brl(linhasMes.reduce((s, l) => s + l.comissao, 0))}
                  </td>
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {semCustos ? '—' : brl(linhasMes.reduce((s, l) => s + l.custos, 0))}
                  </td>
                  <td className="px-2.5 py-2 text-right font-semibold">
                    {semCustos ? '—' : brl(linhasMes.reduce((s, l) => s + l.lucro, 0))}
                  </td>
                </tr>
              </Tabela>
              <div className="mt-2 space-y-1 text-xs text-tinta-suave">
                <p>
                  Reservas, receita e comissão entram no mês do{' '}
                  <strong>check-out</strong> — é assim que as plataformas fecham o
                  mês. Já <strong>noites e ocupação</strong> contam as noites que
                  caíram dentro de cada mês, para que uma estadia longa não infle um
                  mês só. “Estadia” é a média de noites por reserva.
                </p>
                <p>
                  Por isso o <strong>Total fechado</strong> pode ficar abaixo do
                  número de reservas lá em cima: os KPIs do topo contam toda reserva
                  que <em>encosta</em> no período, e uma hospedagem que só termina
                  depois do fim da janela ainda não fechou nenhum mês. As{' '}
                  <strong>noites</strong>, essas sim, batem exatamente com o topo.
                </p>
              </div>
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
