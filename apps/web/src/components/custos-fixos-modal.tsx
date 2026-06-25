'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { brl, brMesAno } from '@/lib/format';
import { CATEGORIAS, catLabel } from '@/lib/constants';

type ImovelLite = { id: string; nome: string };

type Fixo = {
  id: string;
  propertyId: string;
  propertyNome: string;
  categoria: string;
  valorMensal: number;
  lancadoNoMes: boolean;
};

type Form = {
  id: string | null;
  propertyId: string;
  categoria: string;
  valorMensal: string;
};

function mesAtual(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

// Janela para gerenciar os custos fixos (modelos recorrentes), agrupados por
// imóvel, com a opção de lançar os que faltam de cada imóvel no mês escolhido.
export function CustosFixosModal({
  imoveis,
  onFechar,
  onMudou,
}: {
  imoveis: ImovelLite[];
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [fixos, setFixos] = useState<Fixo[]>([]);
  const [mes, setMes] = useState(mesAtual());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [lancando, setLancando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    id: null,
    propertyId: imoveis[0]?.id ?? '',
    categoria: 'ENERGIA',
    valorMensal: '',
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const fx = await api.get<Fixo[]>(`/recurring-costs?mes=${mes}`);
      setFixos(fx);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar os custos fixos.',
      );
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Agrupa os modelos por imóvel.
  const grupos = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; itens: Fixo[]; total: number; faltam: number }
    >();
    for (const f of fixos) {
      if (!map.has(f.propertyId))
        map.set(f.propertyId, {
          nome: f.propertyNome,
          itens: [],
          total: 0,
          faltam: 0,
        });
      const g = map.get(f.propertyId)!;
      g.itens.push(f);
      g.total += f.valorMensal;
      if (!f.lancadoNoMes) g.faltam += 1;
    }
    return [...map.entries()].map(([propertyId, g]) => ({ propertyId, ...g }));
  }, [fixos]);

  function limparForm() {
    setForm({
      id: null,
      propertyId: imoveis[0]?.id ?? '',
      categoria: 'ENERGIA',
      valorMensal: '',
    });
  }

  function editar(f: Fixo) {
    setForm({
      id: f.id,
      propertyId: f.propertyId,
      categoria: f.categoria,
      valorMensal: String(f.valorMensal),
    });
  }

  async function salvar() {
    if (!form.propertyId) return setErro('Selecione o imóvel.');
    if (!(Number(form.valorMensal) > 0)) return setErro('Informe o valor mensal.');
    setErro(null);
    setSalvando(true);
    try {
      const payload = {
        propertyId: form.propertyId,
        categoria: form.categoria,
        valorMensal: Number(form.valorMensal),
      };
      if (form.id) await api.patch(`/recurring-costs/${form.id}`, payload);
      else await api.post('/recurring-costs', payload);
      limparForm();
      await carregar();
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(f: Fixo) {
    if (
      !window.confirm(
        `Excluir custo fixo?\n${catLabel(f.categoria)} · ${f.propertyNome} · ${brl(f.valorMensal)}/mês`,
      )
    )
      return;
    try {
      await api.del(`/recurring-costs/${f.id}`);
      await carregar();
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao excluir.');
    }
  }

  // Lança os custos fixos que ainda faltam para UM imóvel, no mês escolhido.
  async function lancarImovel(propertyId: string, nome: string) {
    setLancando(propertyId);
    setMsg(null);
    setErro(null);
    try {
      const r = await api.post<{ lancados: number }>('/costs/lancar-fixos', {
        propertyId,
        mes,
      });
      await carregar();
      onMudou();
      setMsg(
        r.lancados
          ? `${r.lancados} custo(s) de ${nome} lançado(s) em ${brMesAno(mes)}.`
          : `${nome}: todos os fixos de ${brMesAno(mes)} já estavam lançados.`,
      );
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao lançar.');
    } finally {
      setLancando(null);
    }
  }

  const campo =
    'mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-mar';
  const rotulo = 'block text-xs font-medium text-tinta';

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-tinta/40 p-4 sm:p-8"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-2xl rounded-carias bg-superficie p-6 shadow-carias"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-tinta">
            Custos fixos por imóvel
          </h2>
          <button
            onClick={onFechar}
            className="text-tinta-suave hover:text-tinta"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-tinta-suave">
          Modelos de despesas que se repetem todo mês. Use o botão de cada imóvel
          para lançar no mês escolhido (o sistema não duplica o que já foi
          lançado).
        </p>

        {/* mês de referência */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-tinta-suave">Mês de referência:</span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value || mesAtual())}
            className="rounded-lg border border-borda-forte bg-white px-2 py-1.5 text-sm text-tinta"
          />
        </div>

        {/* formulário de adicionar/editar */}
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-carias border border-borda bg-areia/40 p-3 sm:grid-cols-[1.4fr_1.2fr_0.8fr_auto]">
          <div>
            <label className={rotulo}>Imóvel</label>
            <select
              className={campo}
              value={form.propertyId}
              onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
            >
              {imoveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo}>Categoria</label>
            <select
              className={campo}
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo}>Valor mensal</label>
            <input
              type="number"
              step="0.01"
              className={campo}
              value={form.valorMensal}
              onChange={(e) => setForm((f) => ({ ...f, valorMensal: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-1">
            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-lg bg-coral px-3 py-2 text-sm font-semibold text-white hover:bg-coral-escuro disabled:opacity-50"
            >
              {form.id ? 'Salvar' : 'Adicionar'}
            </button>
            {form.id ? (
              <button
                onClick={limparForm}
                className="rounded-lg border border-borda-forte px-3 py-2 text-sm text-tinta hover:bg-areia"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </div>

        {erro ? (
          <p className="mb-3 rounded-lg border border-vermelho/30 bg-vermelho/10 p-2 text-sm text-vermelho">
            {erro}
          </p>
        ) : null}
        {msg ? (
          <p className="mb-3 rounded-lg border border-verde/30 bg-verde/10 p-2 text-sm text-verde">
            {msg}
          </p>
        ) : null}

        {/* blocos por imóvel */}
        {carregando ? (
          <p className="py-4 text-sm text-tinta-suave">Carregando…</p>
        ) : grupos.length === 0 ? (
          <p className="py-4 text-sm text-tinta-suave">
            Nenhum custo fixo cadastrado ainda. Use o formulário acima para
            adicionar.
          </p>
        ) : (
          <div className="space-y-3">
            {grupos.map((g) => (
              <div
                key={g.propertyId}
                className="rounded-carias border border-borda"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda bg-areia/30 px-3 py-2">
                  <div>
                    <span className="font-semibold text-tinta">{g.nome}</span>
                    <span className="ml-2 text-xs text-tinta-suave">
                      {brl(g.total)}/mês ·{' '}
                      {g.faltam === 0
                        ? 'tudo lançado'
                        : `${g.faltam} a lançar`}
                    </span>
                  </div>
                  <button
                    onClick={() => lancarImovel(g.propertyId, g.nome)}
                    disabled={lancando === g.propertyId || g.faltam === 0}
                    className="rounded-lg bg-coral px-3 py-1.5 text-xs font-semibold text-white hover:bg-coral-escuro disabled:opacity-40"
                  >
                    {lancando === g.propertyId
                      ? 'Lançando…'
                      : `Lançar os que faltam (${brMesAno(mes)})`}
                  </button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {g.itens.map((f) => (
                      <tr
                        key={f.id}
                        className="border-b border-borda last:border-0"
                      >
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-areia px-2 py-0.5 text-xs font-medium text-mar">
                            {catLabel(f.categoria)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-tinta tabular-nums">
                          {brl(f.valorMensal)}
                        </td>
                        <td className="px-3 py-2">
                          {f.lancadoNoMes ? (
                            <span className="rounded-full bg-verde/15 px-2 py-0.5 text-xs font-semibold text-verde">
                              Lançado
                            </span>
                          ) : (
                            <span className="rounded-full bg-ambar/20 px-2 py-0.5 text-xs font-semibold text-[#9a6a14]">
                              A lançar
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => editar(f)}
                              className="rounded-lg border border-borda-forte px-2 py-1 text-xs font-medium text-tinta hover:bg-areia"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => excluir(f)}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-vermelho hover:bg-areia"
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
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onFechar}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral-escuro"
          >
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
}
