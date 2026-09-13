'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brDate } from '@/lib/format';

// --- tipos -------------------------------------------------------------

type ImovelLite = {
  id: string;
  nome: string;
  checkin: string; // horário padrão de entrada do imóvel, ex.: '15:00'
  checkout: string; // horário padrão de saída, ex.: '11:00'
};

type Reserva = {
  id: string;
  kind: 'BOOKING' | 'BLOCK';
  propertyId: string;
  propertyNome: string;
  plataforma: string;
  hospedeNome: string;
  hospedeTel: string;
  checkin: string;
  checkout: string;
  noites: number;
  hospedes: number;
  status: string;
  motivo: string;
};

type Evento = {
  id: string;
  kind: 'BOOKING' | 'BLOCK';
  classe: 'in' | 'mid' | 'block';
  texto: string;
  titulo: string;
};

// Cores dos eventos (espelham a legenda do protótipo).
const COR_EVENTO: Record<Evento['classe'], string> = {
  in: '#9ad0bb',
  mid: '#cfe6dc',
  block: '#c9bbe0',
};

const DOWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// --- helpers de data ---------------------------------------------------

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function hojeDate(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
function isoOf(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(dt.getDate()).padStart(2, '0')}`;
}
function diasAte(iso: string): string {
  const dias = Math.round(
    (parseISO(iso).getTime() - hojeDate().getTime()) / 86_400_000,
  );
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias < 0) return `${Math.abs(dias)}d atrás`;
  return `em ${dias}d`;
}

// --- componente principal ---------------------------------------------

export function AgendaClient() {
  const router = useRouter();
  const [imoveis, setImoveis] = useState<ImovelLite[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroImovel, setFiltroImovel] = useState('');
  const [filtroPlataforma, setFiltroPlataforma] = useState('');
  const [alcance, setAlcance] = useState<'mes' | '30' | 'tudo'>('mes');

  const hoje = hojeDate();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-based

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [imv, res] = await Promise.all([
        api.get<ImovelLite[]>('/properties'),
        api.get<Reserva[]>('/reservations'),
      ]);
      setImoveis(imv);
      setReservas(res);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar a agenda. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirReserva(r: { id: string }) {
    router.push(`/reservas?edit=${r.id}`);
  }

  // --- próximos check-ins / check-outs ---

  /**
   * Lista consolidada do mês que está sendo exibido no calendário: uma linha
   * por reserva, com entrada e saída juntas. Entra na lista toda reserva que
   * encosta no mês (começou antes e ainda está rolando, começa e termina
   * dentro, ou termina depois), ordenada pela data de entrada.
   */
  const doMes = useMemo(() => {
    let ini: string;
    let fim: string;
    if (alcance === 'mes') {
      ini = isoOf(new Date(ano, mes, 1));
      fim = isoOf(new Date(ano, mes + 1, 0));
    } else if (alcance === '30') {
      ini = isoOf(hoje);
      const d = new Date(hoje);
      d.setDate(d.getDate() + 30);
      fim = isoOf(d);
    } else {
      ini = '0000-01-01';
      fim = '9999-12-31';
    }
    return reservas
      .filter(
        (r) =>
          r.status !== 'CANCELADA' &&
          (!filtroImovel || r.propertyId === filtroImovel) &&
          (!filtroPlataforma ||
            (r.plataforma || 'Outra') === filtroPlataforma ||
            r.kind === 'BLOCK') &&
          r.checkin <= fim &&
          r.checkout >= ini,
      )
      .sort((a, b) => (a.checkin < b.checkin ? -1 : a.checkin > b.checkin ? 1 : 0));
    // hoje é estável dentro do dia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservas, filtroImovel, filtroPlataforma, alcance, ano, mes]);

  const plataformas = useMemo(() => {
    const set = new Set<string>();
    for (const r of reservas) {
      if (r.kind !== 'BLOCK') set.add(r.plataforma || 'Outra');
    }
    const ordem = ['Airbnb', 'Booking.com', 'Direto', 'Outra'];
    return [...set].sort((a, b) => {
      const ia = ordem.indexOf(a);
      const ib = ordem.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [reservas]);

  // Horários padrão de cada imóvel, para mostrar junto das datas.
  const horarios = useMemo(() => {
    const mapa = new Map<string, { checkin: string; checkout: string }>();
    for (const i of imoveis) {
      mapa.set(i.id, {
        checkin: i.checkin || '15:00',
        checkout: i.checkout || '11:00',
      });
    }
    return mapa;
  }, [imoveis]);

  // --- eventos do calendário por dia ---

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    const visiveis = reservas.filter(
      (r) =>
        r.status !== 'CANCELADA' &&
        (!filtroImovel || r.propertyId === filtroImovel),
    );
    for (const r of visiveis) {
      const ci = parseISO(r.checkin);
      const co = parseISO(r.checkout);
      // ocupa cada dia em [check-in, check-out)
      for (let dt = new Date(ci); dt < co; dt.setDate(dt.getDate() + 1)) {
        const chave = isoOf(dt);
        const lista = mapa.get(chave) ?? [];
        if (r.kind === 'BLOCK') {
          lista.push({
            id: r.id,
            kind: 'BLOCK',
            classe: 'block',
            texto: 'Bloqueio',
            titulo: `Bloqueio · ${r.propertyNome} · ${r.motivo || ''} · ${brDate(
              r.checkin,
            )}→${brDate(r.checkout)}`,
          });
        } else {
          const det = `${r.hospedeNome || 'Hóspede'} · ${r.propertyNome}\nCheck-in ${brDate(
            r.checkin,
          )} · Check-out ${brDate(r.checkout)}\n${r.hospedes || 1} hóspede(s)${
            r.hospedeTel ? ` · ${r.hospedeTel}` : ''
          }`;
          const ehCheckin = chave === r.checkin;
          lista.push({
            id: r.id,
            kind: 'BOOKING',
            classe: ehCheckin ? 'in' : 'mid',
            texto: ehCheckin
              ? `▸ ${r.hospedeNome || 'Check-in'}`
              : r.hospedeNome || 'Hospedado',
            titulo: det,
          });
        }
        mapa.set(chave, lista);
      }
    }
    return mapa;
  }, [reservas, filtroImovel]);

  // --- montagem das células do mês ---

  const celulas = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const inicioSemana = primeiro.getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const hojeStr = isoOf(hojeDate());
    const out: {
      dia: number | null;
      iso?: string;
      hoje?: boolean;
      eventos?: Evento[];
    }[] = [];
    for (let i = 0; i < inicioSemana; i++) out.push({ dia: null });
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(
        dia,
      ).padStart(2, '0')}`;
      out.push({
        dia,
        iso,
        hoje: iso === hojeStr,
        eventos: eventosPorDia.get(iso) ?? [],
      });
    }
    return out;
  }, [ano, mes, eventosPorDia]);

  function mudarMes(n: number) {
    const d = new Date(ano, mes + n, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }
  function irHoje() {
    const h = hojeDate();
    setAno(h.getFullYear());
    setMes(h.getMonth());
  }

  const rotuloMes = new Date(ano, mes, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const semImoveis = !carregando && !erro && imoveis.length === 0;

  return (
    <AppShell
      atual="agenda"
      titulo="Agenda"
      subtitulo="Calendário, check-ins e check-outs"
      acao={
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
            Cadastre um imóvel primeiro
          </h3>
          <p className="mt-1 text-tinta-suave">
            A agenda mostra reservas e bloqueios dos seus imóveis.
          </p>
        </div>
      ) : (
        <>
          {/* calendário */}
          <div className="rounded-carias border border-borda bg-superficie p-5 shadow-carias">
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => mudarMes(-1)}
                className="rounded-lg border border-borda-forte px-3 py-1.5 text-tinta hover:bg-areia"
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <span className="font-display text-lg font-semibold capitalize text-tinta">
                {rotuloMes}
              </span>
              <button
                onClick={() => mudarMes(1)}
                className="rounded-lg border border-borda-forte px-3 py-1.5 text-tinta hover:bg-areia"
                aria-label="Próximo mês"
              >
                ›
              </button>
              <button
                onClick={irHoje}
                className="ml-1 rounded-lg px-3 py-1.5 text-sm font-medium text-mar hover:bg-areia"
              >
                Hoje
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DOWS.map((d) => (
                <div
                  key={d}
                  className="pb-1 text-center text-xs font-medium text-tinta-suave"
                >
                  {d}
                </div>
              ))}
              {celulas.map((c, i) =>
                c.dia === null ? (
                  <div key={`v-${i}`} className="min-h-[84px] rounded-lg" />
                ) : (
                  <div
                    key={c.iso}
                    className={`min-h-[84px] rounded-lg border p-1 ${
                      c.hoje
                        ? 'border-coral bg-coral/5'
                        : 'border-borda bg-white'
                    }`}
                  >
                    <div
                      className={`mb-0.5 text-right text-xs ${
                        c.hoje
                          ? 'font-bold text-coral'
                          : 'text-tinta-suave'
                      }`}
                    >
                      {c.dia}
                    </div>
                    {c.eventos!.slice(0, 3).map((e, j) => (
                      <button
                        key={`${e.id}-${j}`}
                        title={e.titulo}
                        onClick={() => abrirReserva(e)}
                        style={{ backgroundColor: COR_EVENTO[e.classe] }}
                        className="mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-[#123038]"
                      >
                        {e.texto}
                      </button>
                    ))}
                    {c.eventos!.length > 3 ? (
                      <div className="text-[10px] text-tinta-suave">
                        +{c.eventos!.length - 3}
                      </div>
                    ) : null}
                  </div>
                ),
              )}
            </div>

            {/* legenda */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-tinta-suave">
              <Legenda cor={COR_EVENTO.in} texto="Check-in" />
              <Legenda cor={COR_EVENTO.mid} texto="Hospedado" />
              <Legenda cor={COR_EVENTO.block} texto="Bloqueio" />
              <Legenda cor="#e07a5f" texto="Hoje" />
            </div>
          </div>

          {/* lista consolidada do mês */}
          <div className="mt-4 rounded-carias border border-borda bg-superficie p-5 shadow-carias">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold text-tinta">
                  Entradas e saídas
                </h3>
                <span className="text-sm text-tinta-suave">
                  {doMes.length} registro(s) ·{' '}
                  {doMes.filter((r) => r.kind !== 'BLOCK').length} reserva(s) ·{' '}
                  {doMes.reduce((s, r) => s + (r.hospedes || 0), 0)} hóspede(s)
                </span>
              </div>
              <div className="inline-flex gap-1 rounded-lg border border-borda bg-areia/40 p-1">
                {(
                  [
                    ['mes', rotuloMes],
                    ['30', 'Próximos 30 dias'],
                    ['tudo', 'Tudo'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setAlcance(v)}
                    className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                      alcance === v
                        ? 'bg-mar text-white'
                        : 'text-tinta-suave hover:bg-areia'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {doMes.length === 0 ? (
              <p className="py-3 text-sm text-tinta-suave">
                Nenhuma reserva ou bloqueio neste mês.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-borda-forte text-left text-xs uppercase tracking-wide text-tinta-suave">
                      <th className="px-2.5 py-2 font-semibold">Entrada</th>
                      <th className="px-2.5 py-2 font-semibold">Saída</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Dias</th>
                      <th className="px-2.5 py-2 font-semibold">Imóvel</th>
                      <th className="px-2.5 py-2 font-semibold">Hóspede</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Hósp.</th>
                      <th className="px-2.5 py-2 font-semibold">Telefone</th>
                      <th className="px-2.5 py-2 font-semibold">Canal</th>
                      <th className="px-2.5 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {doMes.map((r) => {
                      const bloqueio = r.kind === 'BLOCK';
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-borda last:border-0"
                        >
                          <td className="whitespace-nowrap px-2.5 py-2">
                            <span className="font-semibold text-tinta">
                              {brDate(r.checkin)}
                            </span>
                            <span className="ml-1.5 text-xs text-tinta-suave">
                              {horarios.get(r.propertyId)?.checkin ?? '15:00'}
                            </span>
                            {r.checkin >= isoOf(hoje) ? (
                              <span className="ml-2 whitespace-nowrap text-xs font-semibold text-coral">
                                {diasAte(r.checkin)}
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2">
                            <span className="text-tinta">{brDate(r.checkout)}</span>
                            <span className="ml-1.5 text-xs text-tinta-suave">
                              {horarios.get(r.propertyId)?.checkout ?? '11:00'}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-right text-tinta-suave">
                            {r.noites}
                          </td>
                          <td className="px-2.5 py-2 text-tinta">
                            {r.propertyNome}
                          </td>
                          <td className="px-2.5 py-2 text-tinta">
                            {bloqueio ? (
                              <em className="text-tinta-suave">
                                Bloqueio{r.motivo ? ` — ${r.motivo}` : ''}
                              </em>
                            ) : (
                              r.hospedeNome || '—'
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-right text-tinta-suave">
                            {bloqueio ? '—' : r.hospedes || 1}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2">
                            {r.hospedeTel ? (
                              <a
                                href={`tel:${r.hospedeTel.replace(/[^0-9+]/g, '')}`}
                                className="font-medium text-mar"
                              >
                                {r.hospedeTel}
                              </a>
                            ) : (
                              <span className="text-tinta-suave">—</span>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-tinta-suave">
                            {bloqueio ? '—' : r.plataforma || '—'}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <button
                              onClick={() => abrirReserva(r)}
                              className="whitespace-nowrap rounded-lg border border-borda-forte px-3 py-1.5 text-xs font-medium text-tinta hover:bg-areia"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-tinta-suave">
              Inclui toda reserva que encosta no período — inclusive as que
              começaram antes ou terminam depois. Canceladas ficam de fora. Os{' '}
              <strong>horários</strong> são os padrões cadastrados no imóvel, não
              por reserva. O <strong>nº de hóspedes</strong> não vem nos relatórios
              do Airbnb nem do Booking: onde aparece 1, pode ser só o valor padrão.
            </p>
          </div>
        </>
      )}
    </AppShell>
  );
}

// --- subcomponentes ----------------------------------------------------

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

