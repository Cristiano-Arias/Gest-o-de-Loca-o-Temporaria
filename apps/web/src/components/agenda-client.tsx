'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brDate } from '@/lib/format';

// --- tipos -------------------------------------------------------------

type ImovelLite = { id: string; nome: string };

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

  const { proxIn, proxOut } = useMemo(() => {
    const hj = isoOf(hoje);
    const futuras = reservas.filter(
      (r) =>
        r.kind !== 'BLOCK' &&
        r.status !== 'CANCELADA' &&
        (!filtroImovel || r.propertyId === filtroImovel),
    );
    const ins = futuras
      .filter((r) => r.checkin >= hj)
      .sort((a, b) => (a.checkin < b.checkin ? -1 : 1))
      .slice(0, 5);
    const outs = futuras
      .filter((r) => r.checkout >= hj)
      .sort((a, b) => (a.checkout < b.checkout ? -1 : 1))
      .slice(0, 5);
    return { proxIn: ins, proxOut: outs };
    // hoje muda a cada render mas isoOf(hoje) é estável no dia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservas, filtroImovel]);

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
        imoveis.length > 1 ? (
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
            Cadastre um imóvel primeiro
          </h3>
          <p className="mt-1 text-tinta-suave">
            A agenda mostra reservas e bloqueios dos seus imóveis.
          </p>
        </div>
      ) : (
        <>
          {/* próximos check-ins / check-outs */}
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MiniLista
              titulo="Próximos check-ins"
              itens={proxIn}
              campo="checkin"
              onEditar={abrirReserva}
            />
            <MiniLista
              titulo="Próximos check-outs"
              itens={proxOut}
              campo="checkout"
              onEditar={abrirReserva}
            />
          </div>

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

function MiniLista({
  titulo,
  itens,
  campo,
  onEditar,
}: {
  titulo: string;
  itens: Reserva[];
  campo: 'checkin' | 'checkout';
  onEditar: (r: { id: string }) => void;
}) {
  const telLink = (t: string) =>
    t ? `tel:${t.replace(/[^0-9+]/g, '')}` : '';

  return (
    <div className="rounded-carias border border-borda bg-superficie p-5 shadow-carias">
      <h3 className="mb-1 font-display text-lg font-semibold text-tinta">
        {titulo}
      </h3>
      {itens.length === 0 ? (
        <p className="py-3 text-sm text-tinta-suave">Nada nos próximos dias.</p>
      ) : (
        itens.map((r) => (
          <div key={r.id} className="border-b border-borda py-3 last:border-0">
            <div className="flex items-baseline justify-between gap-2">
              <strong className="text-tinta">
                {r.hospedeNome || 'Hóspede'}
              </strong>
              <span className="whitespace-nowrap text-xs font-semibold text-coral">
                {diasAte(r[campo])}
              </span>
            </div>
            <div className="mb-1.5 mt-0.5 text-xs text-tinta-suave">
              {r.propertyNome} · {r.plataforma || '—'}
            </div>
            <div className="text-[13px] leading-relaxed text-tinta">
              <span className="text-tinta-suave">Check-in:</span>{' '}
              {brDate(r.checkin)} &nbsp;·&nbsp;{' '}
              <span className="text-tinta-suave">Check-out:</span>{' '}
              {brDate(r.checkout)}
              <br />
              <span className="text-tinta-suave">Hóspedes:</span>{' '}
              {r.hospedes || 1}
              {r.hospedeTel ? (
                <>
                  {' '}
                  &nbsp;·&nbsp; <span className="text-tinta-suave">Tel:</span>{' '}
                  <a
                    href={telLink(r.hospedeTel)}
                    className="font-semibold text-mar"
                  >
                    {r.hospedeTel}
                  </a>
                </>
              ) : null}
            </div>
            <div className="mt-2">
              <button
                onClick={() => onEditar(r)}
                className="rounded-lg border border-borda-forte px-3 py-1.5 text-xs font-medium text-tinta hover:bg-areia"
              >
                Editar informações
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
