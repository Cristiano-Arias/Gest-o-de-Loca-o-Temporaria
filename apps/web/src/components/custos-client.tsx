'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { CustosFixosModal } from '@/components/custos-fixos-modal';
import { api, ApiError } from '@/lib/api';
import { brl, brMesAno } from '@/lib/format';
import { CATEGORIAS, catLabel, PAGOS, statusLabel } from '@/lib/constants';

// --- tipos -------------------------------------------------------------

type ImovelLite = { id: string; nome: string };

type Custo = {
  id: string;
  propertyId: string;
  propertyNome: string;
  mes: string; // AAAA-MM
  data: string;
  categoria: string;
  valor: number;
  descricao: string;
  statusPagamento: string;
};

type FormCusto = {
  propertyId: string;
  mes: string;
  categoria: string;
  valor: string;
  descricao: string;
  statusPagamento: string;
};

// Mês atual no formato AAAA-MM.
function mesAtual(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

// --- componente principal ---------------------------------------------

export function CustosClient() {
  const [imoveis, setImoveis] = useState<ImovelLite[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroImovel, setFiltroImovel] = useState('');
  const [filtroCat, setFiltroCat] = useState('');
  const [filtroPag, setFiltroPag] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormCusto | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [lancando, setLancando] = useState(false);
  const [fixosAberto, setFixosAberto] = useState(false);
  const [mesFixos, setMesFixos] = useState(mesAtual());

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
      const [imv, cst] = await Promise.all([
        api.get<ImovelLite[]>('/properties'),
        api.get<Custo[]>('/costs'),
      ]);
      setImoveis(imv);
      setCustos(cst);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar os custos. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // --- lista filtrada + totais ---

  const lista = useMemo(() => {
    return custos.filter(
      (c) =>
        (!filtroImovel || c.propertyId === filtroImovel) &&
        (!filtroCat || c.categoria === filtroCat) &&
        (!filtroPag || c.statusPagamento === filtroPag),
    );
  }, [custos, filtroImovel, filtroCat, filtroPag]);

  const total = useMemo(() => lista.reduce((s, c) => s + c.valor, 0), [lista]);
  const aPagar = useMemo(
    () =>
      lista
        .filter((c) => c.statusPagamento !== 'PAGO')
        .reduce((s, c) => s + c.valor, 0),
    [lista],
  );

  // --- abrir formulário ---

  function novoCusto() {
    setEditandoId(null);
    setForm({
      propertyId: filtroImovel || imoveis[0]?.id || '',
      mes: mesAtual(),
      categoria: 'LIMPEZA',
      valor: '',
      descricao: '',
      statusPagamento: 'PENDENTE',
    });
    setModalAberto(true);
  }

  function editarCusto(c: Custo) {
    setEditandoId(c.id);
    setForm({
      propertyId: c.propertyId,
      mes: c.mes,
      categoria: c.categoria,
      valor: String(c.valor),
      descricao: c.descricao,
      statusPagamento: c.statusPagamento,
    });
    setModalAberto(true);
  }

  function fechar() {
    if (salvando) return;
    setModalAberto(false);
    setForm(null);
  }

  async function salvar() {
    if (!form) return;
    if (!form.propertyId) return mostrarToast('Selecione o imóvel', true);
    if (!(Number(form.valor) > 0))
      return mostrarToast('Informe um valor', true);

    const payload = {
      propertyId: form.propertyId,
      mes: form.mes,
      categoria: form.categoria,
      valor: Number(form.valor),
      descricao: form.descricao.trim(),
      statusPagamento: form.statusPagamento,
    };
    setSalvando(true);
    try {
      if (editandoId) {
        await api.patch(`/costs/${editandoId}`, payload);
      } else {
        await api.post('/costs', payload);
      }
      fechar();
      await carregar();
      mostrarToast(editandoId ? 'Custo atualizado' : 'Custo lançado');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao salvar.';
      mostrarToast(msg, true);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Custo) {
    if (!window.confirm('Excluir este custo?')) return;
    try {
      await api.del(`/costs/${c.id}`);
      await carregar();
      mostrarToast('Custo removido');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao excluir.';
      mostrarToast(msg, true);
    }
  }

  async function lancarFixos() {
    setLancando(true);
    try {
      const r = await api.post<{ lancados: number }>('/costs/lancar-fixos', {
        propertyId: filtroImovel || undefined,
        mes: mesFixos,
      });
      await carregar();
      mostrarToast(
        r.lancados
          ? `${r.lancados} custo(s) fixo(s) lançado(s) em ${brMesAno(mesFixos)}`
          : `Custos fixos de ${brMesAno(mesFixos)} já estavam lançados`,
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao lançar.';
      mostrarToast(msg, true);
    } finally {
      setLancando(false);
    }
  }

  // --- render ---

  const semImoveis = !carregando && !erro && imoveis.length === 0;
  const selectClasse =
    'rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta';

  return (
    <AppShell
      atual="custos"
      titulo="Custos"
      subtitulo={carregando ? 'Carregando…' : `${custos.length} lançamento(s)`}
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
        <CaixaVazia
          titulo="Cadastre um imóvel primeiro"
          texto="Os custos precisam estar ligados a um imóvel."
        />
      ) : (
        <>
          {/* barra de ações + filtros */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              onClick={novoCusto}
              className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white shadow-carias hover:bg-coral-escuro"
            >
              + Custo
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-borda-forte bg-white pl-2">
              <span className="text-xs text-tinta-suave">Fixos de</span>
              <input
                type="month"
                value={mesFixos}
                onChange={(e) => setMesFixos(e.target.value || mesAtual())}
                className="bg-transparent px-1 py-2 text-sm text-tinta outline-none"
                title="Escolha o mês (pode ser passado) para lançar os custos fixos"
              />
              <button
                onClick={lancarFixos}
                disabled={lancando}
                className="rounded-r-lg bg-areia px-3 py-2 text-sm font-medium text-mar hover:bg-areia/70 disabled:opacity-50"
              >
                {lancando ? 'Lançando…' : 'Lançar fixos'}
              </button>
            </div>
            <button
              onClick={() => setFixosAberto(true)}
              className="rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium text-tinta hover:bg-areia"
            >
              Custos fixos
            </button>

            {imoveis.length > 1 ? (
              <select
                value={filtroImovel}
                onChange={(e) => setFiltroImovel(e.target.value)}
                className={selectClasse}
              >
                <option value="">Todos os imóveis</option>
                {imoveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={filtroCat}
              onChange={(e) => setFiltroCat(e.target.value)}
              className={selectClasse}
            >
              <option value="">Todas categorias</option>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={filtroPag}
              onChange={(e) => setFiltroPag(e.target.value)}
              className={selectClasse}
            >
              <option value="">Todo status</option>
              {PAGOS.map((p) => (
                <option key={p} value={p}>
                  {statusLabel(p)}
                </option>
              ))}
            </select>

            <span className="ml-auto text-sm text-tinta-suave">
              Total: <strong className="text-tinta">{brl(total)}</strong> · A
              pagar: <strong className="text-vermelho">{brl(aPagar)}</strong>
            </span>
          </div>

          {lista.length === 0 ? (
            <CaixaVazia
              titulo="Nenhum custo lançado"
              texto="Adicione despesas de limpeza, condomínio, gás, manutenção…"
            />
          ) : (
            <TabelaCustos
              lista={lista}
              onEditar={editarCusto}
              onExcluir={excluir}
            />
          )}
        </>
      )}

      {modalAberto && form ? (
        <ModalCusto
          titulo={editandoId ? 'Editar custo' : 'Novo custo'}
          imoveis={imoveis}
          form={form}
          setForm={setForm as React.Dispatch<React.SetStateAction<FormCusto>>}
          salvando={salvando}
          onFechar={fechar}
          onSalvar={salvar}
        />
      ) : null}

      {fixosAberto ? (
        <CustosFixosModal
          imoveis={imoveis}
          onFechar={() => setFixosAberto(false)}
          onMudou={carregar}
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

function CaixaVazia({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-carias border border-dashed border-borda-forte bg-superficie p-10 text-center">
      <h3 className="font-display text-xl font-semibold text-tinta">{titulo}</h3>
      <p className="mt-1 text-tinta-suave">{texto}</p>
    </div>
  );
}

function corPagamento(status: string): string {
  switch (status) {
    case 'PAGO':
      return 'bg-verde/15 text-verde';
    case 'ATRASADO':
      return 'bg-vermelho/15 text-vermelho';
    case 'PENDENTE':
      return 'bg-ambar/20 text-[#9a6a14]';
    default:
      return 'bg-tinta/10 text-tinta-suave';
  }
}

function TabelaCustos({
  lista,
  onEditar,
  onExcluir,
}: {
  lista: Custo[];
  onEditar: (c: Custo) => void;
  onExcluir: (c: Custo) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-carias border border-borda bg-superficie shadow-carias">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tinta-suave">
            <th className="px-4 py-3 font-medium">Mês</th>
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 font-medium">Imóvel / Descrição</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
            <th className="px-4 py-3 font-medium">Pagamento</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id} className="border-b border-borda last:border-0">
              <td className="px-4 py-3 align-top capitalize text-tinta">
                {brMesAno(c.mes)}
              </td>
              <td className="px-4 py-3 align-top">
                <span className="rounded-full bg-areia px-2.5 py-0.5 text-xs font-medium text-mar">
                  {catLabel(c.categoria)}
                </span>
              </td>
              <td className="px-4 py-3 align-top">
                <div className="text-tinta">{c.propertyNome}</div>
                {c.descricao ? (
                  <div className="text-xs text-tinta-suave">{c.descricao}</div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right align-top font-semibold text-tinta">
                {brl(c.valor)}
              </td>
              <td className="px-4 py-3 align-top">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${corPagamento(
                    c.statusPagamento,
                  )}`}
                >
                  {statusLabel(c.statusPagamento)}
                </span>
              </td>
              <td className="px-4 py-3 align-top">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => onEditar(c)}
                    className="rounded-lg border border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta hover:bg-areia"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onExcluir(c)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-vermelho hover:bg-areia"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CAMPO =
  'mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-mar';
const ROTULO = 'block text-sm font-medium text-tinta';

function ModalCusto({
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
  form: FormCusto;
  setForm: React.Dispatch<React.SetStateAction<FormCusto>>;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const set = (campo: keyof FormCusto, v: string) =>
    setForm((f) => ({ ...f, [campo]: v }));

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-tinta/40 p-4 sm:p-8"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-lg rounded-carias bg-superficie p-6 shadow-carias"
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
              <label className={ROTULO}>Mês de referência *</label>
              <input
                type="month"
                className={CAMPO}
                value={form.mes}
                onChange={(e) => set('mes', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ROTULO}>Categoria *</label>
              <select
                className={CAMPO}
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={ROTULO}>Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                className={CAMPO}
                value={form.valor}
                onChange={(e) => set('valor', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={ROTULO}>Descrição</label>
            <input
              className={CAMPO}
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className={ROTULO}>Status de pagamento</label>
            <select
              className={CAMPO}
              value={form.statusPagamento}
              onChange={(e) => set('statusPagamento', e.target.value)}
            >
              {PAGOS.map((p) => (
                <option key={p} value={p}>
                  {statusLabel(p)}
                </option>
              ))}
            </select>
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
