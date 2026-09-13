'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brl, pct, dec1 } from '@/lib/format';
import { BarrasVerticais, CartaoGrafico } from '@/components/charts';
import {
  type ReservaMetrica,
  type CustoMetrica,
  type ImovelMetrica,
  type LinhaMes,
  type TotaisPeriodo,
  periodoRange,
  dataBR,
  plataformasPresentes,
  tresTempos,
  serieReceita6x6,
  tabelaPorMes,
  agruparPorAno,
  somarMeses,
} from '@/lib/metrics';

const MES_NOME = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

// Cores das barras do gráfico, por tempo.
const COR_PASSADO = '#28727c'; // mar
const COR_ATUAL = '#e07a5f'; // coral
const COR_FUTURO = '#e9a13b'; // âmbar

export function PainelClient() {
  const [imoveis, setImoveis] = useState<ImovelMetrica[]>([]);
  const [reservas, setReservas] = useState<ReservaMetrica[]>([]);
  const [custos, setCustos] = useState<CustoMetrica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroImovel, setFiltroImovel] = useState('');
  const [filtroPlataforma, setFiltroPlataforma] = useState('');
  const [anosAbertos, setAnosAbertos] = useState<number[]>([
    new Date().getFullYear(),
  ]);
  // Recorte da tabela ano a ano: 'tudo', um ano ('2026') ou 'custom'.
  const [recorte, setRecorte] = useState('tudo');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [imv, res, cus] = await Promise.all([
        api.get<ImovelMetrica[]>('/properties'),
        api.get<ReservaMetrica[]>('/reservations'),
        api.get<CustoMetrica[]>('/costs'),
      ]);
      setImoveis(imv);
      setReservas(res);
      setCustos(cus);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar os dados. A API já está no ar?',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // --- filtros ---------------------------------------------------------

  const plataformas = useMemo(
    () => plataformasPresentes(reservas, ''),
    [reservas],
  );

  // O filtro de plataforma é aplicado uma vez; o resto da tela usa esta lista.
  const reservasVis = useMemo(
    () =>
      filtroPlataforma
        ? reservas.filter((r) => (r.plataforma || 'Outra') === filtroPlataforma)
        : reservas,
    [reservas, filtroPlataforma],
  );

  /**
   * Custos não são lançados por plataforma — condomínio, energia e limpeza são
   * do imóvel, não do canal. Com um canal escolhido eles saem da conta e a tela
   * mostra "—" em custo e lucro, em vez de um número falso.
   */
  const semCustos = filtroPlataforma !== '';
  const custosVis = useMemo(
    () => (semCustos ? [] : custos),
    [custos, semCustos],
  );

  // Anos que têm dados, para o seletor de período.
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    for (const r of reservasVis) {
      if (r.kind === 'BOOKING' && r.status !== 'CANCELADA') {
        set.add(Number(r.checkout.slice(0, 4)));
      }
    }
    for (const c of custosVis) set.add(Number(c.data.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [reservasVis, custosVis]);

  // --- cálculos --------------------------------------------------------

  const tempos = useMemo(
    () => tresTempos(reservasVis, filtroImovel),
    [reservasVis, filtroImovel],
  );

  const serie = useMemo(
    () => serieReceita6x6(reservasVis, filtroImovel),
    [reservasVis, filtroImovel],
  );

  // Intervalo da tabela, conforme o recorte escolhido.
  const [ini, fim] = useMemo<[Date, Date]>(() => {
    if (recorte === 'custom') {
      const inteiro = periodoRange('tudo', reservasVis, custosVis);
      const d = de ? new Date(`${de}T00:00:00`) : inteiro[0];
      const a = ate ? new Date(`${ate}T00:00:00`) : inteiro[1];
      return a >= d ? [d, a] : [a, d];
    }
    if (recorte !== 'tudo') {
      const ano = Number(recorte);
      return [new Date(ano, 0, 1), new Date(ano, 11, 31)];
    }
    return periodoRange('tudo', reservasVis, custosVis);
  }, [recorte, de, ate, reservasVis, custosVis]);

  const regua = useMemo(
    () =>
      tabelaPorMes(
        reservasVis,
        custosVis,
        imoveis.length,
        filtroImovel,
        ini,
        fim,
      ),
    [reservasVis, custosVis, imoveis.length, filtroImovel, ini, fim],
  );

  const anos = useMemo(() => agruparPorAno(regua), [regua]);
  const geral = useMemo(() => somarMeses(regua), [regua]);

  const canais = useMemo(() => {
    const set = new Set<string>();
    for (const l of regua) {
      for (const c of Object.keys(l.porPlataforma)) set.add(c);
    }
    const ordem = ['Airbnb', 'Booking.com', 'Direto', 'Outra'];
    return [...set].sort((a, b) => {
      const ia = ordem.indexOf(a);
      const ib = ordem.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [regua]);

  useEffect(() => {
    if (recorte !== 'tudo' && recorte !== 'custom') {
      setAnosAbertos([Number(recorte)]);
    }
  }, [recorte]);

  function alternarAno(ano: number) {
    setAnosAbertos((atual) =>
      atual.includes(ano) ? atual.filter((a) => a !== ano) : [...atual, ano],
    );
  }

  // --- render ----------------------------------------------------------

  const semImoveis = !carregando && !erro && imoveis.length === 0;

  return (
    <AppShell
      atual="painel"
      titulo="Painel"
      subtitulo="Receita realizada, deste mês e contratada"
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
            <select
              value={recorte}
              onChange={(e) => setRecorte(e.target.value)}
              className="rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta"
            >
              <option value="tudo">Todo o período</option>
              {anosDisponiveis.map((a) => (
                <option key={a} value={String(a)}>
                  Ano de {a}
                </option>
              ))}
              <option value="custom">Escolher datas…</option>
            </select>
            {recorte === 'custom' ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-2 py-1 text-sm text-tinta">
                <span className="text-xs text-tinta-suave">de</span>
                <input
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className="bg-transparent text-sm text-tinta outline-none"
                />
                <span className="text-xs text-tinta-suave">até</span>
                <input
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className="bg-transparent text-sm text-tinta outline-none"
                />
              </div>
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
            Cadastre um imóvel e importe suas reservas para ver seus números aqui.
          </p>
        </div>
      ) : (
        <>
          {/* a premissa, dita uma vez e valendo para a tela toda */}
          <p className="mb-4 rounded-lg border border-borda bg-areia/50 px-3 py-2 text-xs text-tinta">
            Toda reserva pertence ao mês em que ela <strong>termina</strong> (o
            check-out) — mesmo critério com que Airbnb e Booking fecham o mês.
            Por isso os meses somam o total sem contar nada duas vezes.
          </p>

          {/* os três tempos */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Tempo
              cor={COR_PASSADO}
              rotulo="Realizado"
              descricao="check-out já aconteceu"
              t={tempos.realizado}
            />
            <Tempo
              cor={COR_ATUAL}
              rotulo={`Este mês — ${tempos.mesAtualLabel}`}
              descricao="termina dentro deste mês"
              t={tempos.atual}
              destaque
            />
            <Tempo
              cor={COR_FUTURO}
              rotulo="Contratado à frente"
              descricao="termina depois deste mês"
              t={tempos.futuro}
            />
          </div>

          {semCustos ? (
            <p className="mb-4 rounded-lg border border-ambar/40 bg-ambar/10 px-3 py-2 text-xs text-tinta">
              Filtrando por <strong>{filtroPlataforma}</strong>. Custos são do
              imóvel, não do canal — por isso custo e lucro aparecem como “—”.
              Receita, noites, ocupação e diária seguem valendo para o canal.
            </p>
          ) : null}

          {/* o único gráfico */}
          <div className="mb-6">
            <CartaoGrafico titulo="Receita líquida por mês — 6 meses para trás, 6 para frente">
              <BarrasVerticais
                labels={serie.map((p) => p.label)}
                valores={serie.map((p) => p.valor)}
                cores={serie.map((p) =>
                  p.tempo === 'passado'
                    ? COR_PASSADO
                    : p.tempo === 'atual'
                      ? COR_ATUAL
                      : COR_FUTURO,
                )}
                divisor={serie.findIndex((p) => p.tempo === 'atual')}
                mostrarValores
                eixoY
                alta
              />
            </CartaoGrafico>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-tinta-suave">
              <Legenda cor={COR_PASSADO} texto="Realizado" />
              <Legenda cor={COR_ATUAL} texto="Mês atual" />
              <Legenda cor={COR_FUTURO} texto="Contratado" />
            </div>
          </div>

          {/* consolidado anual, com os meses por dentro */}
          <Secao
            titulo={
              recorte === 'tudo'
                ? 'Ano a ano — clique no ano para ver os meses'
                : recorte === 'custom'
                  ? `Período escolhido — ${dataBR(ini)} a ${dataBR(fim)}`
                  : `Ano de ${recorte}`
            }
          >
            <Tabela
              cabecalho={[
                'Período',
                'Reservas',
                ...canais,
                'Noites',
                'Estadia',
                'Ocupação',
                'Receita líq.',
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
              {anos.map((bloco) => {
                const aberto = anosAbertos.includes(bloco.ano);
                return (
                  <Linhas key={bloco.ano}>
                    <tr
                      onClick={() => alternarAno(bloco.ano)}
                      className="cursor-pointer border-b border-borda bg-areia/40 hover:bg-areia"
                    >
                      <td className="px-2.5 py-2 font-semibold text-tinta">
                        <span className="mr-1.5 inline-block w-3 text-tinta-suave">
                          {aberto ? '▾' : '▸'}
                        </span>
                        {bloco.ano}
                      </td>
                      <Numeros t={bloco.total} canais={canais} semCustos={semCustos} negrito />
                    </tr>
                    {aberto
                      ? bloco.meses.map((l) => (
                          <tr key={l.chave} className="border-b border-borda">
                            <td className="px-2.5 py-2 pl-8 text-tinta-suave">
                              {MES_NOME[l.mes]}
                            </td>
                            <Numeros t={l} canais={canais} semCustos={semCustos} />
                          </tr>
                        ))
                      : null}
                  </Linhas>
                );
              })}
              <tr className="border-t-2 border-borda-forte bg-mar/10">
                <td className="px-2.5 py-2.5 font-semibold text-tinta">
                  Desde o início
                </td>
                <Numeros t={geral} canais={canais} semCustos={semCustos} negrito />
              </tr>
            </Tabela>
            <p className="mt-2 text-xs text-tinta-suave">
              <strong>Noites e ocupação</strong> contam as noites que caíram dentro
              de cada mês, para que uma estadia longa não infle um mês só.{' '}
              <strong>Estadia</strong> é a média de noites por reserva.{' '}
              Canceladas ficam de fora de tudo. O filtro de período recorta{' '}
              <em>esta tabela</em>; os três cartões e o gráfico são sempre em
              relação a hoje.
            </p>
          </Secao>

          {carregando ? (
            <p className="text-sm text-tinta-suave">Carregando…</p>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

// --- subcomponentes ----------------------------------------------------

// Agrupa linhas de tabela sem criar elemento extra no HTML.
function Linhas({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tempo({
  cor,
  rotulo,
  descricao,
  t,
  destaque,
}: {
  cor: string;
  rotulo: string;
  descricao: string;
  t: { receitaLiquida: number; reservas: number; noites: number };
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-carias border bg-superficie p-4 shadow-carias ${
        destaque ? 'border-coral/40' : 'border-borda'
      }`}
      style={{ borderTop: `4px solid ${cor}` }}
    >
      <div className="text-xs font-medium text-tinta-suave">{rotulo}</div>
      <div className="mt-1 font-display text-3xl font-semibold text-tinta">
        {brl(t.receitaLiquida)}
      </div>
      <div className="mt-1 text-xs text-tinta-suave">
        {t.reservas} reserva(s) · {t.noites} noite(s)
      </div>
      <div className="mt-0.5 text-[11px] text-tinta-suave">{descricao}</div>
    </div>
  );
}

// As células numéricas, iguais para mês, ano e total geral.
function Numeros({
  t,
  canais,
  semCustos,
  negrito,
}: {
  t: LinhaMes | TotaisPeriodo;
  canais: string[];
  semCustos: boolean;
  negrito?: boolean;
}) {
  const f = negrito ? 'font-semibold' : '';
  return (
    <>
      <td className={`px-2.5 py-2 text-right ${f}`}>{t.reservas}</td>
      {canais.map((c) => (
        <td key={c} className="px-2.5 py-2 text-right text-tinta-suave">
          {t.porPlataforma[c] ?? 0}
        </td>
      ))}
      <td className={`px-2.5 py-2 text-right ${f}`}>{t.noites}</td>
      <td className="px-2.5 py-2 text-right text-tinta-suave">
        {dec1(t.estadia)}
      </td>
      <td className="px-2.5 py-2 text-right text-tinta-suave">{pct(t.ocup)}</td>
      <td className={`px-2.5 py-2 text-right ${f}`}>{brl(t.receitaLiquida)}</td>
      <td className="px-2.5 py-2 text-right text-tinta-suave">
        {brl(t.comissao)}
      </td>
      <td className={`px-2.5 py-2 text-right ${f}`}>
        {semCustos ? '—' : brl(t.custos)}
      </td>
      <td
        className={`px-2.5 py-2 text-right font-semibold ${
          semCustos
            ? 'text-tinta-suave'
            : t.lucro >= 0
              ? 'text-verde'
              : 'text-vermelho'
        }`}
      >
        {semCustos ? '—' : brl(t.lucro)}
      </td>
    </>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i
        className="inline-block h-3 w-3 rounded"
        style={{ backgroundColor: cor }}
      />
      {texto}
    </span>
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
