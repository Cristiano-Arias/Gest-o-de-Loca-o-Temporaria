'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brl } from '@/lib/format';
import { PLATAFORMAS, CATEGORIAS, catLabel } from '@/lib/constants';

// --- tipos -------------------------------------------------------------

type CustoFixo = { categoria: string; valorMensal: number };

type Imovel = {
  id: string;
  nome: string;
  endereco: string | null;
  capacidade: number;
  checkin: string | null;
  checkout: string | null;
  taxaLimpeza: number;
  observacoes: string | null;
  plataformas: string[];
  custosFixos: CustoFixo[];
};

// Linha de custo fixo no formulário (valor fica como texto enquanto digita).
type LinhaFixo = { categoria: string; valor: string };

type FormState = {
  nome: string;
  endereco: string;
  capacidade: string;
  checkin: string;
  checkout: string;
  taxaLimpeza: string;
  plataformas: string[];
  custosFixos: LinhaFixo[];
  observacoes: string;
};

const FORM_VAZIO: FormState = {
  nome: '',
  endereco: '',
  capacidade: '2',
  checkin: '15:00',
  checkout: '11:00',
  taxaLimpeza: '',
  plataformas: [],
  custosFixos: [],
  observacoes: '',
};

// --- componente principal ---------------------------------------------

export function ImoveisClient() {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const [toast, setToast] = useState<{ msg: string; erro: boolean } | null>(
    null,
  );

  const mostrarToast = useCallback((msg: string, ehErro = false) => {
    setToast({ msg, erro: ehErro });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await api.get<Imovel[]>('/properties');
      setImoveis(dados);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar os imóveis. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // --- abrir formulário ---

  function novoImovel() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  }

  function editarImovel(p: Imovel) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      endereco: p.endereco ?? '',
      capacidade: String(p.capacidade ?? 2),
      checkin: p.checkin ?? '15:00',
      checkout: p.checkout ?? '11:00',
      taxaLimpeza: p.taxaLimpeza ? String(p.taxaLimpeza) : '',
      plataformas: [...p.plataformas],
      custosFixos: p.custosFixos.map((c) => ({
        categoria: c.categoria,
        valor: String(c.valorMensal),
      })),
      observacoes: p.observacoes ?? '',
    });
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  // --- helpers do formulário ---

  function togglePlataforma(nome: string) {
    setForm((f) => ({
      ...f,
      plataformas: f.plataformas.includes(nome)
        ? f.plataformas.filter((x) => x !== nome)
        : [...f.plataformas, nome],
    }));
  }

  function addLinhaFixo() {
    setForm((f) => ({
      ...f,
      custosFixos: [
        ...f.custosFixos,
        { categoria: CATEGORIAS[0].value, valor: '' },
      ],
    }));
  }

  function setLinhaFixo(i: number, campo: keyof LinhaFixo, valor: string) {
    setForm((f) => ({
      ...f,
      custosFixos: f.custosFixos.map((l, idx) =>
        idx === i ? { ...l, [campo]: valor } : l,
      ),
    }));
  }

  function removerLinhaFixo(i: number) {
    setForm((f) => ({
      ...f,
      custosFixos: f.custosFixos.filter((_, idx) => idx !== i),
    }));
  }

  // --- salvar ---

  async function salvar() {
    const nome = form.nome.trim();
    if (!nome) {
      mostrarToast('Informe o nome do imóvel', true);
      return;
    }

    const payload = {
      nome,
      endereco: form.endereco.trim(),
      capacidade: Number(form.capacidade) || 2,
      checkin: form.checkin,
      checkout: form.checkout,
      taxaLimpeza: Number(form.taxaLimpeza) || 0,
      observacoes: form.observacoes.trim(),
      plataformas: form.plataformas,
      custosFixos: form.custosFixos
        .map((l) => ({
          categoria: l.categoria,
          valorMensal: Number(l.valor) || 0,
        }))
        .filter((x) => x.valorMensal > 0),
    };

    setSalvando(true);
    try {
      if (editandoId) {
        await api.patch(`/properties/${editandoId}`, payload);
      } else {
        await api.post('/properties', payload);
      }
      setModalAberto(false);
      await carregar();
      mostrarToast(editandoId ? 'Imóvel atualizado' : 'Imóvel cadastrado');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao salvar.';
      mostrarToast(msg, true);
    } finally {
      setSalvando(false);
    }
  }

  // --- excluir ---

  async function excluir(p: Imovel) {
    const ok = window.confirm(
      `Excluir “${p.nome}”?\n\nReservas e custos vinculados também serão removidos. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      await api.del(`/properties/${p.id}`);
      await carregar();
      mostrarToast('Imóvel excluído');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao excluir.';
      mostrarToast(msg, true);
    }
  }

  // --- render ---

  const subtitulo = carregando
    ? 'Carregando…'
    : `${imoveis.length} imóvel(is) cadastrado(s)`;

  return (
    <AppShell
      atual="imoveis"
      titulo="Imóveis"
      subtitulo={subtitulo}
      acao={
        <button
          onClick={novoImovel}
          className="rounded-lg bg-coral px-4 py-2.5 text-sm font-semibold text-white shadow-carias transition hover:bg-coral-escuro"
        >
          + Novo imóvel
        </button>
      }
    >
      {erro ? (
        <div className="mb-6 rounded-carias border border-borda bg-superficie p-5">
          <p className="text-tinta">{erro}</p>
          <button
            onClick={carregar}
            className="mt-3 rounded-lg border border-borda-forte px-3 py-2 text-sm font-medium text-tinta hover:bg-areia"
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {!carregando && !erro && imoveis.length === 0 ? (
        <EstadoVazio onNovo={novoImovel} />
      ) : null}

      {imoveis.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {imoveis.map((p) => (
            <CardImovel
              key={p.id}
              imovel={p}
              onEditar={() => editarImovel(p)}
              onExcluir={() => excluir(p)}
            />
          ))}
        </div>
      ) : null}

      {modalAberto ? (
        <ModalImovel
          titulo={editandoId ? 'Editar imóvel' : 'Novo imóvel'}
          form={form}
          setForm={setForm}
          salvando={salvando}
          onFechar={fecharModal}
          onSalvar={salvar}
          onTogglePlataforma={togglePlataforma}
          onAddFixo={addLinhaFixo}
          onSetFixo={setLinhaFixo}
          onRemoverFixo={removerLinhaFixo}
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

function EstadoVazio({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="rounded-carias border border-dashed border-borda-forte bg-superficie p-10 text-center">
      <h3 className="font-display text-xl font-semibold text-tinta">
        Nenhum imóvel ainda
      </h3>
      <p className="mt-1 text-tinta-suave">
        Cadastre seu primeiro imóvel para começar.
      </p>
      <button
        onClick={onNovo}
        className="mt-5 rounded-lg bg-coral px-4 py-2.5 text-sm font-semibold text-white hover:bg-coral-escuro"
      >
        + Novo imóvel
      </button>
    </div>
  );
}

function CardImovel({
  imovel: p,
  onEditar,
  onExcluir,
}: {
  imovel: Imovel;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const totalFixos = p.custosFixos.reduce(
    (s, x) => s + Number(x.valorMensal || 0),
    0,
  );

  return (
    <div className="flex flex-col rounded-carias border border-borda bg-superficie p-5 shadow-carias">
      <h3 className="font-display text-lg font-semibold text-tinta">{p.nome}</h3>
      <div className="mt-0.5 text-sm text-tinta-suave">
        {p.endereco || 'Sem endereço'}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.plataformas.length ? (
          p.plataformas.map((pl) => (
            <span
              key={pl}
              className="rounded-full bg-areia px-2.5 py-0.5 text-xs font-medium text-mar"
            >
              {pl}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-areia px-2.5 py-0.5 text-xs text-tinta-suave">
            Sem plataforma
          </span>
        )}
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        <Linha rotulo="Capacidade" valor={`${p.capacidade || '—'} hóspedes`} />
        <Linha
          rotulo="Check-in / out"
          valor={`${p.checkin || '15:00'} · ${p.checkout || '11:00'}`}
        />
        <Linha rotulo="Taxa de limpeza" valor={brl(p.taxaLimpeza)} />
        <Linha rotulo="Custos fixos/mês" valor={brl(totalFixos)} />
      </dl>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onEditar}
          className="rounded-lg border border-borda-forte px-3 py-2 text-sm font-medium text-tinta hover:bg-areia"
        >
          Editar
        </button>
        <button
          onClick={onExcluir}
          className="rounded-lg px-3 py-2 text-sm font-medium text-vermelho hover:bg-areia"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-tinta-suave">{rotulo}</dt>
      <dd className="font-semibold text-tinta">{valor}</dd>
    </div>
  );
}

function ModalImovel({
  titulo,
  form,
  setForm,
  salvando,
  onFechar,
  onSalvar,
  onTogglePlataforma,
  onAddFixo,
  onSetFixo,
  onRemoverFixo,
}: {
  titulo: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
  onTogglePlataforma: (nome: string) => void;
  onAddFixo: () => void;
  onSetFixo: (i: number, campo: keyof LinhaFixo, valor: string) => void;
  onRemoverFixo: (i: number) => void;
}) {
  const campo =
    'mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-mar';
  const rotulo = 'block text-sm font-medium text-tinta';

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

        <div className="space-y-4">
          <div>
            <label className={rotulo}>Nome do imóvel *</label>
            <input
              className={campo}
              value={form.nome}
              onChange={(e) =>
                setForm((f) => ({ ...f, nome: e.target.value }))
              }
              placeholder="Ex: Apto Wai Wai Cumbuco"
            />
          </div>

          <div>
            <label className={rotulo}>Endereço</label>
            <input
              className={campo}
              value={form.endereco}
              onChange={(e) =>
                setForm((f) => ({ ...f, endereco: e.target.value }))
              }
              placeholder="Rua, número, cidade"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={rotulo}>Capacidade</label>
              <input
                type="number"
                min={1}
                className={campo}
                value={form.capacidade}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacidade: e.target.value }))
                }
              />
            </div>
            <div>
              <label className={rotulo}>Check-in</label>
              <input
                type="time"
                className={campo}
                value={form.checkin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, checkin: e.target.value }))
                }
              />
            </div>
            <div>
              <label className={rotulo}>Check-out</label>
              <input
                type="time"
                className={campo}
                value={form.checkout}
                onChange={(e) =>
                  setForm((f) => ({ ...f, checkout: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className={rotulo}>Taxa de limpeza (R$)</label>
            <input
              type="number"
              step="0.01"
              className={campo}
              value={form.taxaLimpeza}
              onChange={(e) =>
                setForm((f) => ({ ...f, taxaLimpeza: e.target.value }))
              }
              placeholder="0,00"
            />
          </div>

          <div>
            <label className={rotulo}>Plataformas</label>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {PLATAFORMAS.map((pl) => (
                <label
                  key={pl}
                  className="flex items-center gap-2 text-sm text-tinta"
                >
                  <input
                    type="checkbox"
                    checked={form.plataformas.includes(pl)}
                    onChange={() => onTogglePlataforma(pl)}
                  />
                  {pl}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={rotulo}>Custos fixos mensais</label>
            <div className="mt-2 space-y-2">
              {form.custosFixos.map((linha, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1.6fr_1fr_auto] items-center gap-2"
                >
                  <select
                    className={`${campo} mt-0`}
                    value={linha.categoria}
                    onChange={(e) => onSetFixo(i, 'categoria', e.target.value)}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    className={`${campo} mt-0`}
                    placeholder="Valor mensal"
                    value={linha.valor}
                    onChange={(e) => onSetFixo(i, 'valor', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoverFixo(i)}
                    className="px-2 text-tinta-suave hover:text-vermelho"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onAddFixo}
              className="mt-2 rounded-lg border border-borda-forte px-3 py-1.5 text-sm font-medium text-tinta hover:bg-areia"
            >
              + Adicionar custo fixo
            </button>
            <p className="mt-1.5 text-xs text-tinta-suave">
              Condomínio, IPTU, energia, gás, internet… também poderão ser
              gerenciados na aba “Custos fixos”.
            </p>
          </div>

          <div>
            <label className={rotulo}>Observações operacionais</label>
            <textarea
              rows={2}
              className={campo}
              value={form.observacoes}
              onChange={(e) =>
                setForm((f) => ({ ...f, observacoes: e.target.value }))
              }
              placeholder="Senha do portão, instruções de limpeza..."
            />
          </div>
        </div>

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
