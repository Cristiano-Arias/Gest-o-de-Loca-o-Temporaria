'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brl } from '@/lib/format';
import { CATEGORIAS, catLabel } from '@/lib/constants';

// --- tipos -------------------------------------------------------------

type ImovelLite = { id: string; nome: string };

type Fixo = {
  id: string;
  propertyId: string;
  propertyNome: string;
  categoria: string;
  valorMensal: number;
  lancadoNoMes: boolean;
};

type FormFixo = {
  propertyId: string;
  categoria: string;
  valorMensal: string;
};

function mesAtual(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

function nomeMes(): string {
  return new Date().toLocaleDateString('pt-BR', { month: 'long' });
}

// --- componente principal ---------------------------------------------

export function FixosClient() {
  const [imoveis, setImoveis] = useState<ImovelLite[]>([]);
  const [fixos, setFixos] = useState<Fixo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroImovel, setFiltroImovel] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormFixo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [lancando, setLancando] = useState(false);

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
      const [imv, fx] = await Promise.all([
        api.get<ImovelLite[]>('/properties'),
        api.get<Fixo[]>(`/recurring-costs?mes=${mesAtual()}`),
      ]);
      setImoveis(imv);
      setFixos(fx);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar os custos fixos. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // --- lista filtrada + total ---

  const lista = useMemo(
    () =>
      filtroImovel
        ? fixos.filter((f) => f.propertyId === filtroImovel)
        : fixos,
    [fixos, filtroImovel],
  );
  const total = useMemo(
    () => lista.reduce((s, f) => s + f.valorMensal, 0),
    [lista],
  );

  // --- abrir formulário ---

  function novoFixo() {
    setEditandoId(null);
    setForm({
      propertyId: filtroImovel || imoveis[0]?.id || '',
      categoria: 'ENERGIA',
      valorMensal: '',
    });
    setModalAberto(true);
  }

  function editarFixo(f: Fixo) {
    setEditandoId(f.id);
    setForm({
      propertyId: f.propertyId,
      categoria: f.categoria,
      valorMensal: String(f.valorMensal),
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
    if (!(Number(form.valorMensal) > 0))
      return mostrarToast('Informe o valor mensal', true);

    const payload = {
      propertyId: form.propertyId,
      categoria: form.categoria,
      valorMensal: Number(form.valorMensal),
    };
    setSalvando(true);
    try {
      if (editandoId) {
        await api.patch(`/recurring-costs/${editandoId}`, payload);
      } else {
        await api.post('/recurring-costs', payload);
      }
      fechar();
      await carregar();
      mostrarToast(editandoId ? 'Custo fixo atualizado' : 'Custo fixo cadastrado');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao salvar.';
      mostrarToast(msg, true);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(f: Fixo) {
    const ok = window.confirm(
      `Excluir custo fixo?\n${catLabel(f.categoria)} · ${f.propertyNome} · ${brl(
        f.valorMensal,
      )}/mês`,
    );
    if (!ok) return;
    try {
      await api.del(`/recurring-costs/${f.id}`);
      await carregar();
      mostrarToast('Custo fixo removido');
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
        mes: mesAtual(),
      });
      await carregar();
      mostrarToast(
        r.lancados
          ? `${r.lancados} custo(s) fixo(s) lançado(s) neste mês`
          : 'Custos fixos deste mês já estavam lançados',
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
  const mesLabel = nomeMes();

  return (
    <AppShell
      atual="fixos"
      titulo="Custos fixos"
      subtitulo={
        carregando ? 'Carregando…' : `${fixos.length} modelo(s) recorrente(s)`
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
        <CaixaVazia
          titulo="Cadastre um imóvel primeiro"
          texto="Os custos fixos ficam ligados a cada imóvel."
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              onClick={novoFixo}
              className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white shadow-carias hover:bg-coral-escuro"
            >
              + Custo fixo
            </button>
            <button
              onClick={lancarFixos}
              disabled={lancando}
              className="rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium text-tinta hover:bg-areia disabled:opacity-50"
            >
              {lancando
                ? 'Lançando…'
                : `Lançar custos fixos de ${mesLabel}`}
            </button>
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
            <span className="ml-auto text-sm text-tinta-suave">
              Total fixo mensal:{' '}
              <strong className="text-tinta">{brl(total)}</strong>
            </span>
          </div>

          {lista.length === 0 ? (
            <CaixaVazia
              titulo="Nenhum custo fixo cadastrado"
              texto="Cadastre energia, internet, IPTU, gás, condomínio… para lançar todo mês em um clique."
            />
          ) : (
            <>
              <TabelaFixos
                lista={lista}
                total={total}
                onEditar={editarFixo}
                onExcluir={excluir}
              />
              <p className="mt-3 text-xs text-tinta-suave">
                Estes valores são modelos recorrentes (sem dia de vencimento —
                só o mês). Use{' '}
                <strong>“Lançar custos fixos de {mesLabel}”</strong> para criar
                as despesas do mês na aba <strong>Custos</strong> (sem duplicar
                o que já foi lançado).
              </p>
            </>
          )}
        </>
      )}

      {modalAberto && form ? (
        <ModalFixo
          titulo={editandoId ? 'Editar custo fixo' : 'Novo custo fixo'}
          imoveis={imoveis}
          form={form}
          setForm={setForm as React.Dispatch<React.SetStateAction<FormFixo>>}
          salvando={salvando}
          onFechar={fechar}
          onSalvar={salvar}
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

function TabelaFixos({
  lista,
  total,
  onEditar,
  onExcluir,
}: {
  lista: Fixo[];
  total: number;
  onEditar: (f: Fixo) => void;
  onExcluir: (f: Fixo) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-carias border border-borda bg-superficie shadow-carias">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tinta-suave">
            <th className="px-4 py-3 font-medium">Imóvel</th>
            <th className="px-4 py-3 font-medium">Categoria</th>
            <th className="px-4 py-3 text-right font-medium">Valor mensal</th>
            <th className="px-4 py-3 font-medium">Status do mês</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {lista.map((f) => (
            <tr key={f.id} className="border-b border-borda last:border-0">
              <td className="px-4 py-3 align-top text-tinta">{f.propertyNome}</td>
              <td className="px-4 py-3 align-top">
                <span className="rounded-full bg-areia px-2.5 py-0.5 text-xs font-medium text-mar">
                  {catLabel(f.categoria)}
                </span>
              </td>
              <td className="px-4 py-3 text-right align-top font-semibold text-tinta">
                {brl(f.valorMensal)}
              </td>
              <td className="px-4 py-3 align-top">
                {f.lancadoNoMes ? (
                  <span className="inline-block rounded-full bg-verde/15 px-2.5 py-0.5 text-xs font-semibold text-verde">
                    Lançado no mês
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-ambar/20 px-2.5 py-0.5 text-xs font-semibold text-[#9a6a14]">
                    A lançar
                  </span>
                )}
              </td>
              <td className="px-4 py-3 align-top">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => onEditar(f)}
                    className="rounded-lg border border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta hover:bg-areia"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onExcluir(f)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-vermelho hover:bg-areia"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-borda">
            <td className="px-4 py-3 font-semibold text-tinta" colSpan={2}>
              Total mensal
            </td>
            <td className="px-4 py-3 text-right font-bold text-tinta">
              {brl(total)}
            </td>
            <td className="px-4 py-3" colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const CAMPO =
  'mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-mar';
const ROTULO = 'block text-sm font-medium text-tinta';

function ModalFixo({
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
  form: FormFixo;
  setForm: React.Dispatch<React.SetStateAction<FormFixo>>;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const set = (campo: keyof FormFixo, v: string) =>
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
              <label className={ROTULO}>Valor mensal (R$) *</label>
              <input
                type="number"
                step="0.01"
                className={CAMPO}
                value={form.valorMensal}
                onChange={(e) => set('valorMensal', e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-tinta-suave">
            O custo fixo é lançado por mês, sem dia de vencimento.
          </p>
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
