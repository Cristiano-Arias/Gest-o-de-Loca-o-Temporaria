'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brl, brDate } from '@/lib/format';
import { PLATAFORMAS, STATUS, statusLabel } from '@/lib/constants';

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
  codigo: string;
  checkin: string;
  checkout: string;
  noites: number;
  hospedes: number;
  valorBruto: number;
  taxaPlataforma: number;
  taxaLimpeza: number;
  valorLiquido: number;
  status: string;
  motivo: string;
};

type FormReserva = {
  propertyId: string;
  plataforma: string;
  hospedeNome: string;
  hospedeTel: string;
  codigo: string;
  checkin: string;
  checkout: string;
  hospedes: string;
  valorBruto: string;
  taxaPlataforma: string;
  taxaLimpeza: string;
  status: string;
};

type FormBloqueio = {
  propertyId: string;
  checkin: string;
  checkout: string;
  motivo: string;
};

// Data de hoje no formato AAAA-MM-DD (comparável como texto).
function hojeISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(t.getDate()).padStart(2, '0')}`;
}

// --- componente principal ---------------------------------------------

export function ReservasClient() {
  const [imoveis, setImoveis] = useState<ImovelLite[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroImovel, setFiltroImovel] = useState('');

  const [modal, setModal] = useState<'reserva' | 'bloqueio' | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formR, setFormR] = useState<FormReserva | null>(null);
  const [formB, setFormB] = useState<FormBloqueio | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [toast, setToast] = useState<{ msg: string; erro: boolean } | null>(
    null,
  );

  const mostrarToast = useCallback((msg: string, ehErro = false) => {
    setToast({ msg, erro: ehErro });
    setTimeout(() => setToast(null), 3200);
  }, []);

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
          : 'Não foi possível carregar as reservas. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Vindo da Agenda como /reservas?edit=<id>: abre o editor da reserva/bloqueio.
  const router = useRouter();
  const params = useSearchParams();
  const [tratouEdit, setTratouEdit] = useState(false);
  useEffect(() => {
    if (tratouEdit || carregando) return;
    const editId = params.get('edit');
    if (!editId) return;
    const r = reservas.find((x) => x.id === editId);
    if (r) {
      if (r.kind === 'BLOCK') editarBloqueio(r);
      else editarReserva(r);
    }
    setTratouEdit(true);
    router.replace('/reservas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, reservas, params, tratouEdit]);

  // --- listas derivadas ---

  const lista = useMemo(() => {
    const arr = filtroImovel
      ? reservas.filter((r) => r.propertyId === filtroImovel)
      : reservas;
    return [...arr].sort((a, b) => (a.checkin < b.checkin ? 1 : -1));
  }, [reservas, filtroImovel]);

  // Receita futura contratada: reservas (não bloqueio) ativas com check-out futuro.
  const futuros = useMemo(() => {
    const hj = hojeISO();
    const fut = reservas.filter(
      (r) =>
        r.kind === 'BOOKING' && r.status !== 'CANCELADA' && r.checkout > hj,
    );
    const porImovel = imoveis.map((p) => {
      const arr = fut.filter((r) => r.propertyId === p.id);
      return {
        nome: p.nome,
        total: arr.reduce((s, r) => s + r.valorLiquido, 0),
        reservas: arr.length,
        noites: arr.reduce((s, r) => s + r.noites, 0),
      };
    });
    const totalGeral = fut.reduce((s, r) => s + r.valorLiquido, 0);
    return { porImovel, totalGeral, totalReservas: fut.length };
  }, [reservas, imoveis]);

  // --- abrir formulários ---

  function novaReserva() {
    setEditandoId(null);
    setFormR({
      propertyId: filtroImovel || imoveis[0]?.id || '',
      plataforma: 'Airbnb',
      hospedeNome: '',
      hospedeTel: '',
      codigo: '',
      checkin: '',
      checkout: '',
      hospedes: '1',
      valorBruto: '',
      taxaPlataforma: '',
      taxaLimpeza: '',
      status: 'CONFIRMADA',
    });
    setModal('reserva');
  }

  function editarReserva(r: Reserva) {
    setEditandoId(r.id);
    setFormR({
      propertyId: r.propertyId,
      plataforma: r.plataforma || 'Airbnb',
      hospedeNome: r.hospedeNome,
      hospedeTel: r.hospedeTel,
      codigo: r.codigo,
      checkin: r.checkin,
      checkout: r.checkout,
      hospedes: String(r.hospedes || 1),
      valorBruto: r.valorBruto ? String(r.valorBruto) : '',
      taxaPlataforma: r.taxaPlataforma ? String(r.taxaPlataforma) : '',
      taxaLimpeza: r.taxaLimpeza ? String(r.taxaLimpeza) : '',
      status: r.status,
    });
    setModal('reserva');
  }

  function novoBloqueio() {
    setEditandoId(null);
    setFormB({
      propertyId: filtroImovel || imoveis[0]?.id || '',
      checkin: '',
      checkout: '',
      motivo: '',
    });
    setModal('bloqueio');
  }

  function editarBloqueio(r: Reserva) {
    setEditandoId(r.id);
    setFormB({
      propertyId: r.propertyId,
      checkin: r.checkin,
      checkout: r.checkout,
      motivo: r.motivo,
    });
    setModal('bloqueio');
  }

  function fechar() {
    if (salvando) return;
    setModal(null);
    setFormR(null);
    setFormB(null);
  }

  // --- salvar ---

  async function salvarReserva() {
    if (!formR) return;
    if (!formR.propertyId) return mostrarToast('Selecione o imóvel', true);
    if (!formR.checkin || !formR.checkout)
      return mostrarToast('Informe check-in e check-out', true);

    const payload = {
      kind: 'BOOKING',
      propertyId: formR.propertyId,
      plataforma: formR.plataforma,
      hospedeNome: formR.hospedeNome.trim(),
      hospedeTel: formR.hospedeTel.trim(),
      codigo: formR.codigo.trim(),
      checkin: formR.checkin,
      checkout: formR.checkout,
      hospedes: Number(formR.hospedes) || 1,
      valorBruto: Number(formR.valorBruto) || 0,
      taxaPlataforma: Number(formR.taxaPlataforma) || 0,
      taxaLimpeza: Number(formR.taxaLimpeza) || 0,
      status: formR.status,
    };
    await enviar(payload, 'Reserva lançada', 'Reserva atualizada');
  }

  async function salvarBloqueio() {
    if (!formB) return;
    if (!formB.propertyId) return mostrarToast('Selecione o imóvel', true);
    if (!formB.checkin || !formB.checkout)
      return mostrarToast('Preencha as datas', true);

    const payload = {
      kind: 'BLOCK',
      propertyId: formB.propertyId,
      checkin: formB.checkin,
      checkout: formB.checkout,
      motivo: formB.motivo.trim(),
    };
    await enviar(payload, 'Período bloqueado', 'Bloqueio atualizado');
  }

  async function enviar(
    payload: unknown,
    msgNovo: string,
    msgEdit: string,
  ) {
    setSalvando(true);
    try {
      if (editandoId) {
        await api.patch(`/reservations/${editandoId}`, payload);
      } else {
        await api.post('/reservations', payload);
      }
      fechar();
      await carregar();
      mostrarToast(editandoId ? msgEdit : msgNovo);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao salvar.';
      mostrarToast(msg, true);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(r: Reserva) {
    const ok = window.confirm(
      `Excluir este ${r.kind === 'BLOCK' ? 'bloqueio' : 'registro'}?`,
    );
    if (!ok) return;
    try {
      await api.del(`/reservations/${r.id}`);
      await carregar();
      mostrarToast('Removido');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao excluir.';
      mostrarToast(msg, true);
    }
  }

  // --- render ---

  const semImoveis = !carregando && !erro && imoveis.length === 0;

  return (
    <AppShell
      atual="reservas"
      titulo="Reservas"
      subtitulo={carregando ? 'Carregando…' : `${reservas.length} registro(s)`}
    >
      {erro ? (
        <Aviso texto={erro} onRetry={carregar} />
      ) : semImoveis ? (
        <CaixaVazia
          titulo="Cadastre um imóvel primeiro"
          texto="As reservas precisam estar ligadas a um imóvel."
        />
      ) : (
        <>
          {/* barra de ações + filtro */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              onClick={novaReserva}
              className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white shadow-carias hover:bg-coral-escuro"
            >
              + Reserva
            </button>
            <button
              onClick={novoBloqueio}
              className="rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium text-tinta hover:bg-areia"
            >
              + Bloqueio
            </button>
            {imoveis.length > 1 ? (
              <select
                value={filtroImovel}
                onChange={(e) => setFiltroImovel(e.target.value)}
                className="ml-auto rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta"
              >
                <option value="">Todos os imóveis</option>
                {imoveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {/* receita futura contratada */}
          <h3 className="mb-2 font-display text-lg font-semibold text-tinta">
            Receita futura contratada
          </h3>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {futuros.porImovel.map((c) => (
              <Kpi
                key={c.nome}
                rotulo={`Futuro · ${c.nome}`}
                valor={brl(c.total)}
                detalhe={`${c.reservas} reserva(s) · ${c.noites} noites`}
              />
            ))}
            <Kpi
              destaque
              rotulo="Futuro · Ambas"
              valor={brl(futuros.totalGeral)}
              detalhe={`${futuros.totalReservas} reserva(s)`}
            />
          </div>

          {/* tabela */}
          {lista.length === 0 ? (
            <CaixaVazia
              titulo="Nenhuma reserva ainda"
              texto="Lance manualmente uma reserva ou um bloqueio."
            />
          ) : (
            <TabelaReservas
              lista={lista}
              onEditarReserva={editarReserva}
              onEditarBloqueio={editarBloqueio}
              onExcluir={excluir}
            />
          )}
        </>
      )}

      {modal === 'reserva' && formR ? (
        <ModalReserva
          titulo={editandoId ? 'Editar reserva' : 'Nova reserva'}
          imoveis={imoveis}
          form={formR}
          setForm={setFormR as React.Dispatch<React.SetStateAction<FormReserva>>}
          salvando={salvando}
          onFechar={fechar}
          onSalvar={salvarReserva}
        />
      ) : null}

      {modal === 'bloqueio' && formB ? (
        <ModalBloqueio
          titulo={editandoId ? 'Editar bloqueio' : 'Novo bloqueio'}
          imoveis={imoveis}
          form={formB}
          setForm={setFormB as React.Dispatch<React.SetStateAction<FormBloqueio>>}
          salvando={salvando}
          onFechar={fechar}
          onSalvar={salvarBloqueio}
        />
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-carias ${
            toast.erro ? 'bg-vermelho' : 'bg-tinta'
          }`}
        >
          {toast.msg}
        </div>
      ) : null}
    </AppShell>
  );
}

// --- subcomponentes ----------------------------------------------------

function Aviso({ texto, onRetry }: { texto: string; onRetry: () => void }) {
  return (
    <div className="rounded-carias border border-borda bg-superficie p-5">
      <p className="text-tinta">{texto}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded-lg border border-borda-forte px-3 py-2 text-sm font-medium text-tinta hover:bg-areia"
      >
        Tentar de novo
      </button>
    </div>
  );
}

function CaixaVazia({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-carias border border-dashed border-borda-forte bg-superficie p-10 text-center">
      <h3 className="font-display text-xl font-semibold text-tinta">{titulo}</h3>
      <p className="mt-1 text-tinta-suave">{texto}</p>
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-carias border p-4 shadow-carias ${
        destaque ? 'border-mar bg-mar text-[#eafcff]' : 'border-borda bg-superficie'
      }`}
    >
      <div
        className={`text-xs font-medium ${
          destaque ? 'text-[#cdeef2]' : 'text-tinta-suave'
        }`}
      >
        {rotulo}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-semibold ${
          destaque ? 'text-white' : 'text-tinta'
        }`}
      >
        {valor}
      </div>
      <div
        className={`mt-0.5 text-xs ${
          destaque ? 'text-[#cdeef2]' : 'text-tinta-suave'
        }`}
      >
        {detalhe}
      </div>
    </div>
  );
}

function corStatus(status: string): string {
  switch (status) {
    case 'CONFIRMADA':
      return 'bg-verde/15 text-verde';
    case 'HOSPEDADO':
      return 'bg-mar/15 text-mar';
    case 'PENDENTE':
      return 'bg-ambar/20 text-[#9a6a14]';
    case 'CANCELADA':
      return 'bg-vermelho/15 text-vermelho';
    case 'BLOQUEADA':
      return 'bg-tinta/10 text-tinta-suave';
    default:
      return 'bg-areia text-tinta-suave';
  }
}

function TabelaReservas({
  lista,
  onEditarReserva,
  onEditarBloqueio,
  onExcluir,
}: {
  lista: Reserva[];
  onEditarReserva: (r: Reserva) => void;
  onEditarBloqueio: (r: Reserva) => void;
  onExcluir: (r: Reserva) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-carias border border-borda bg-superficie shadow-carias">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tinta-suave">
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Hóspede / Imóvel</th>
            <th className="px-4 py-3 font-medium">Período</th>
            <th className="px-4 py-3 font-medium">Código</th>
            <th className="px-4 py-3 text-right font-medium">Valor líquido</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {lista.map((r) => {
            const bloqueio = r.kind === 'BLOCK';
            return (
              <tr key={r.id} className="border-b border-borda last:border-0">
                <td className="px-4 py-3 align-top">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${corStatus(
                      bloqueio ? 'BLOQUEADA' : r.status,
                    )}`}
                  >
                    {bloqueio ? 'Bloqueio' : statusLabel(r.status)}
                  </span>
                  {!bloqueio && r.plataforma ? (
                    <div className="mt-1 text-xs text-tinta-suave">
                      {r.plataforma}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-tinta">
                    {bloqueio
                      ? r.motivo || 'Manutenção'
                      : r.hospedeNome || 'Hóspede'}
                  </div>
                  <div className="text-xs text-tinta-suave">
                    {r.propertyNome}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="text-tinta">
                    {brDate(r.checkin)} → {brDate(r.checkout)}
                  </div>
                  <div className="text-xs text-tinta-suave">
                    {r.noites} noite(s)
                    {!bloqueio ? ` · ${r.hospedes || 1} hósp.` : ''}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-tinta-suave">
                  {bloqueio ? '—' : r.codigo || '—'}
                </td>
                <td className="px-4 py-3 text-right align-top">
                  {bloqueio ? (
                    <span className="text-tinta-suave">—</span>
                  ) : (
                    <>
                      <div className="font-semibold text-tinta">
                        {brl(r.valorLiquido)}
                      </div>
                      <div className="text-xs text-tinta-suave">
                        bruto {brl(r.valorBruto)}
                      </div>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() =>
                        bloqueio ? onEditarBloqueio(r) : onEditarReserva(r)
                      }
                      className="rounded-lg border border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta hover:bg-areia"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onExcluir(r)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-vermelho hover:bg-areia"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- estilos de campo reaproveitados ---
const CAMPO =
  'mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-mar';
const ROTULO = 'block text-sm font-medium text-tinta';

function Moldura({
  titulo,
  salvando,
  onFechar,
  onSalvar,
  children,
}: {
  titulo: string;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-tinta/40 p-4 sm:p-8"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-xl rounded-carias bg-superficie p-6 shadow-carias"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-tinta">
            {titulo}
          </h2>
          <button
            onClick={onFechar}
            className="text-tinta-suave hover:text-tinta"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium text-tinta hover:bg-areia disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSalvar}
            disabled={salvando}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral-escuro disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalReserva({
  titulo,
  imoveis,
  form,
  setForm,
  salvando,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  imoveis: ImovelLite[];
  form: FormReserva;
  setForm: React.Dispatch<React.SetStateAction<FormReserva>>;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const set = (campo: keyof FormReserva, v: string) =>
    setForm((f) => ({ ...f, [campo]: v }));
  const liquido = (Number(form.valorBruto) || 0) - (Number(form.taxaPlataforma) || 0);

  return (
    <Moldura
      titulo={titulo}
      salvando={salvando}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={ROTULO}>Imóvel *</label>
          <select
            className={CAMPO}
            value={form.propertyId}
            onChange={(e) => set('propertyId', e.target.value)}
          >
            {imoveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ROTULO}>Plataforma</label>
          <select
            className={CAMPO}
            value={form.plataforma}
            onChange={(e) => set('plataforma', e.target.value)}
          >
            {PLATAFORMAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={ROTULO}>Hóspede</label>
          <input
            className={CAMPO}
            value={form.hospedeNome}
            onChange={(e) => set('hospedeNome', e.target.value)}
            placeholder="Nome do hóspede"
          />
        </div>
        <div>
          <label className={ROTULO}>Código da reserva</label>
          <input
            className={CAMPO}
            value={form.codigo}
            onChange={(e) => set('codigo', e.target.value)}
            placeholder="Ex: HMABC123"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={ROTULO}>Check-in *</label>
          <input
            type="date"
            className={CAMPO}
            value={form.checkin}
            onChange={(e) => set('checkin', e.target.value)}
          />
        </div>
        <div>
          <label className={ROTULO}>Check-out *</label>
          <input
            type="date"
            className={CAMPO}
            value={form.checkout}
            onChange={(e) => set('checkout', e.target.value)}
          />
        </div>
        <div>
          <label className={ROTULO}>Hóspedes</label>
          <input
            type="number"
            min={1}
            className={CAMPO}
            value={form.hospedes}
            onChange={(e) => set('hospedes', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={ROTULO}>Valor bruto (R$)</label>
          <input
            type="number"
            step="0.01"
            className={CAMPO}
            value={form.valorBruto}
            onChange={(e) => set('valorBruto', e.target.value)}
          />
        </div>
        <div>
          <label className={ROTULO}>Taxa plataforma (R$)</label>
          <input
            type="number"
            step="0.01"
            className={CAMPO}
            value={form.taxaPlataforma}
            onChange={(e) => set('taxaPlataforma', e.target.value)}
          />
        </div>
        <div>
          <label className={ROTULO}>Taxa limpeza (R$)</label>
          <input
            type="number"
            step="0.01"
            className={CAMPO}
            value={form.taxaLimpeza}
            onChange={(e) => set('taxaLimpeza', e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg bg-areia px-3 py-2 text-sm text-tinta">
        Valor líquido (bruto − taxa plataforma):{' '}
        <strong>{brl(liquido)}</strong>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={ROTULO}>Status</label>
          <select
            className={CAMPO}
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ROTULO}>Telefone / contato</label>
          <input
            className={CAMPO}
            value={form.hospedeTel}
            onChange={(e) => set('hospedeTel', e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
    </Moldura>
  );
}

function ModalBloqueio({
  titulo,
  imoveis,
  form,
  setForm,
  salvando,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  imoveis: ImovelLite[];
  form: FormBloqueio;
  setForm: React.Dispatch<React.SetStateAction<FormBloqueio>>;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const set = (campo: keyof FormBloqueio, v: string) =>
    setForm((f) => ({ ...f, [campo]: v }));

  return (
    <Moldura
      titulo={titulo}
      salvando={salvando}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <div>
        <label className={ROTULO}>Imóvel *</label>
        <select
          className={CAMPO}
          value={form.propertyId}
          onChange={(e) => set('propertyId', e.target.value)}
        >
          {imoveis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={ROTULO}>De *</label>
          <input
            type="date"
            className={CAMPO}
            value={form.checkin}
            onChange={(e) => set('checkin', e.target.value)}
          />
        </div>
        <div>
          <label className={ROTULO}>Até *</label>
          <input
            type="date"
            className={CAMPO}
            value={form.checkout}
            onChange={(e) => set('checkout', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={ROTULO}>Motivo</label>
        <input
          className={CAMPO}
          value={form.motivo}
          onChange={(e) => set('motivo', e.target.value)}
          placeholder="Manutenção, uso próprio…"
        />
      </div>
    </Moldura>
  );
}
