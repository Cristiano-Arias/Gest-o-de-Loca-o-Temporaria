'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ApiError } from '@/lib/api';
import { brl, brDate, brMesAno } from '@/lib/format';
import { situacaoAluguelLabel } from '@/lib/constants';

// --- tipos -------------------------------------------------------------

type Mensalidade = {
  id: string;
  competencia: string; // AAAA-MM-DD (1º dia do mês)
  vencimento: string;
  valor: number;
  status: 'EM_ABERTO' | 'PAGO';
  pagoEm: string | null;
  situacao: 'PAGO' | 'ATRASADO' | 'EM_ABERTO';
};

type Contrato = {
  id: string;
  propertyId: string;
  imovelNome: string;
  inquilinoNome: string;
  inquilinoTelefone: string | null;
  inquilinoEmail: string | null;
  inquilinoDocumento: string | null;
  valorMensal: number;
  outrosCustos: number;
  outrosCustosDescricao: string | null;
  diaVencimento: number;
  inicio: string;
  fim: string | null;
  incluiInternet: boolean;
  incluiAgua: boolean;
  incluiEnergia: boolean;
  observacoes: string | null;
  status: 'ATIVO' | 'ENCERRADO';
  mensalidades: Mensalidade[];
};

type Imovel = { id: string; nome: string; tipo: string };

type FormState = {
  propertyId: string;
  inquilinoNome: string;
  inquilinoTelefone: string;
  inquilinoEmail: string;
  inquilinoDocumento: string;
  valorMensal: string;
  outrosCustos: string;
  outrosCustosDescricao: string;
  diaVencimento: string;
  inicio: string;
  fim: string;
  incluiInternet: boolean;
  incluiAgua: boolean;
  incluiEnergia: boolean;
  observacoes: string;
};

const FORM_VAZIO: FormState = {
  propertyId: '',
  inquilinoNome: '',
  inquilinoTelefone: '',
  inquilinoEmail: '',
  inquilinoDocumento: '',
  valorMensal: '',
  outrosCustos: '',
  outrosCustosDescricao: '',
  diaVencimento: '5',
  inicio: '',
  fim: '',
  incluiInternet: false,
  incluiAgua: false,
  incluiEnergia: false,
  observacoes: '',
};

const mesAtual = () => new Date().toISOString().slice(0, 7); // AAAA-MM

// --- componente principal ---------------------------------------------

export function AlugueisClient() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
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
      const [cs, ims] = await Promise.all([
        api.get<Contrato[]>('/leases'),
        api.get<Imovel[]>('/properties'),
      ]);
      setContratos(cs);
      setImoveis(ims);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Sua sessão expirou. Faça login novamente.'
          : 'Não foi possível carregar os aluguéis. A API já está no ar?';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Imóveis elegíveis para contrato: os marcados como Longo prazo.
  const imoveisLongoPrazo = useMemo(
    () => imoveis.filter((i) => i.tipo === 'LONGO_PRAZO'),
    [imoveis],
  );

  // --- KPIs (o "painel" do longo prazo) ---
  const kpis = useMemo(() => {
    const mes = mesAtual();
    let contratado = 0;
    let recebidoMes = 0;
    let previstoMes = 0;
    let emAberto = 0;
    let atrasado = 0;

    for (const c of contratos) {
      if (c.status === 'ATIVO') contratado += c.valorMensal + c.outrosCustos;
      for (const p of c.mensalidades) {
        if (p.competencia.slice(0, 7) === mes) {
          previstoMes += p.valor;
          if (p.situacao === 'PAGO') recebidoMes += p.valor;
        }
        if (p.situacao === 'EM_ABERTO') emAberto += p.valor;
        if (p.situacao === 'ATRASADO') atrasado += p.valor;
      }
    }
    return { contratado, recebidoMes, previstoMes, emAberto, atrasado };
  }, [contratos]);

  // --- abrir formulário ---
  function novoContrato() {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO, propertyId: imoveisLongoPrazo[0]?.id ?? '' });
    setModalAberto(true);
  }

  function editarContrato(c: Contrato) {
    setEditandoId(c.id);
    setForm({
      propertyId: c.propertyId,
      inquilinoNome: c.inquilinoNome,
      inquilinoTelefone: c.inquilinoTelefone ?? '',
      inquilinoEmail: c.inquilinoEmail ?? '',
      inquilinoDocumento: c.inquilinoDocumento ?? '',
      valorMensal: String(c.valorMensal),
      outrosCustos: c.outrosCustos ? String(c.outrosCustos) : '',
      outrosCustosDescricao: c.outrosCustosDescricao ?? '',
      diaVencimento: String(c.diaVencimento),
      inicio: c.inicio,
      fim: c.fim ?? '',
      incluiInternet: c.incluiInternet,
      incluiAgua: c.incluiAgua,
      incluiEnergia: c.incluiEnergia,
      observacoes: c.observacoes ?? '',
    });
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  // --- salvar ---
  async function salvar() {
    if (!form.propertyId) {
      mostrarToast('Selecione o imóvel', true);
      return;
    }
    if (!form.inquilinoNome.trim()) {
      mostrarToast('Informe o nome do inquilino', true);
      return;
    }
    if (!form.inicio) {
      mostrarToast('Informe a data de início do contrato', true);
      return;
    }
    if (!(Number(form.valorMensal) > 0)) {
      mostrarToast('Informe o valor do aluguel', true);
      return;
    }

    const payload = {
      propertyId: form.propertyId,
      inquilinoNome: form.inquilinoNome.trim(),
      inquilinoTelefone: form.inquilinoTelefone.trim(),
      inquilinoEmail: form.inquilinoEmail.trim(),
      inquilinoDocumento: form.inquilinoDocumento.trim(),
      valorMensal: Number(form.valorMensal) || 0,
      outrosCustos: Number(form.outrosCustos) || 0,
      outrosCustosDescricao: form.outrosCustosDescricao.trim(),
      diaVencimento: Number(form.diaVencimento) || 5,
      inicio: form.inicio,
      fim: form.fim || undefined,
      incluiInternet: form.incluiInternet,
      incluiAgua: form.incluiAgua,
      incluiEnergia: form.incluiEnergia,
      observacoes: form.observacoes.trim(),
    };

    setSalvando(true);
    try {
      if (editandoId) {
        await api.patch(`/leases/${editandoId}`, payload);
      } else {
        await api.post('/leases', payload);
      }
      setModalAberto(false);
      await carregar();
      mostrarToast(editandoId ? 'Contrato atualizado' : 'Contrato criado');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao salvar.';
      mostrarToast(msg, true);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Contrato) {
    const ok = window.confirm(
      `Excluir o contrato de “${c.inquilinoNome}”?\n\nAs mensalidades vinculadas também serão removidas. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      await api.del(`/leases/${c.id}`);
      await carregar();
      mostrarToast('Contrato excluído');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao excluir.';
      mostrarToast(msg, true);
    }
  }

  // --- marcar mensalidade paga / reabrir ---
  async function alternarPagamento(c: Contrato, p: Mensalidade) {
    const novo = p.status === 'PAGO' ? 'EM_ABERTO' : 'PAGO';
    try {
      await api.patch(`/leases/${c.id}/installments/${p.id}`, { status: novo });
      await carregar();
      mostrarToast(novo === 'PAGO' ? 'Mensalidade quitada' : 'Mensalidade reaberta');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao atualizar.';
      mostrarToast(msg, true);
    }
  }

  // --- render ---
  const subtitulo = carregando
    ? 'Carregando…'
    : `${contratos.length} contrato(s) · ${imoveisLongoPrazo.length} imóvel(is) de longo prazo`;

  return (
    <AppShell
      atual="alugueis"
      titulo="Aluguéis (longo prazo)"
      subtitulo={subtitulo}
      acao={
        <button
          onClick={novoContrato}
          disabled={imoveisLongoPrazo.length === 0}
          className="rounded-lg bg-coral px-4 py-2.5 text-sm font-semibold text-white shadow-carias transition hover:bg-coral-escuro disabled:opacity-50"
          title={
            imoveisLongoPrazo.length === 0
              ? 'Cadastre um imóvel do tipo “Longo prazo” primeiro'
              : undefined
          }
        >
          + Novo contrato
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

      {/* KPIs do longo prazo */}
      {!erro ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            rotulo="Aluguel contratado / mês"
            valor={brl(kpis.contratado)}
            cor="#28727c"
          />
          <Kpi
            rotulo="Recebido no mês"
            valor={brl(kpis.recebidoMes)}
            sub={`de ${brl(kpis.previstoMes)} previstos`}
            cor="#2f9e6f"
          />
          <Kpi
            rotulo="Em aberto (a vencer)"
            valor={brl(kpis.emAberto)}
            cor="#e9a13b"
          />
          <Kpi
            rotulo="Atrasado (inadimplência)"
            valor={brl(kpis.atrasado)}
            cor="#c0492f"
          />
        </div>
      ) : null}

      {imoveisLongoPrazo.length === 0 && !carregando && !erro ? (
        <div className="mb-6 rounded-carias border border-dashed border-borda-forte bg-superficie p-5 text-sm text-tinta-suave">
          Para usar esta aba, vá em <strong>Imóveis</strong>, edite (ou cadastre)
          um imóvel e marque o tipo como <strong>“Longo prazo”</strong>. Depois
          volte aqui para criar o contrato.
        </div>
      ) : null}

      {!carregando && !erro && contratos.length === 0 ? (
        <EstadoVazio
          podeCriar={imoveisLongoPrazo.length > 0}
          onNovo={novoContrato}
        />
      ) : null}

      {contratos.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {contratos.map((c) => (
            <CardContrato
              key={c.id}
              contrato={c}
              onEditar={() => editarContrato(c)}
              onExcluir={() => excluir(c)}
              onAlternar={(p) => alternarPagamento(c, p)}
            />
          ))}
        </div>
      ) : null}

      {modalAberto ? (
        <ModalContrato
          titulo={editandoId ? 'Editar contrato' : 'Novo contrato'}
          form={form}
          setForm={setForm}
          imoveis={imoveisLongoPrazo}
          salvando={salvando}
          onFechar={fecharModal}
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

function Kpi({
  rotulo,
  valor,
  sub,
  cor,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  cor: string;
}) {
  return (
    <div className="rounded-carias border border-borda bg-superficie p-4 shadow-carias">
      <div className="text-xs font-medium text-tinta-suave">{rotulo}</div>
      <div
        className="mt-1 font-display text-2xl font-semibold"
        style={{ color: cor }}
      >
        {valor}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-tinta-suave">{sub}</div> : null}
    </div>
  );
}

function EstadoVazio({
  podeCriar,
  onNovo,
}: {
  podeCriar: boolean;
  onNovo: () => void;
}) {
  return (
    <div className="rounded-carias border border-dashed border-borda-forte bg-superficie p-10 text-center">
      <h3 className="font-display text-xl font-semibold text-tinta">
        Nenhum contrato ainda
      </h3>
      <p className="mt-1 text-tinta-suave">
        Crie um contrato de aluguel de longo prazo para começar a controlar as
        mensalidades.
      </p>
      {podeCriar ? (
        <button
          onClick={onNovo}
          className="mt-5 rounded-lg bg-coral px-4 py-2.5 text-sm font-semibold text-white hover:bg-coral-escuro"
        >
          + Novo contrato
        </button>
      ) : null}
    </div>
  );
}

const CHIP: Record<string, string> = {
  PAGO: 'bg-[#dcefe5] text-[#1f6b4a]',
  ATRASADO: 'bg-[#f7dcd5] text-[#a13a23]',
  EM_ABERTO: 'bg-[#fbeccd] text-[#8a6312]',
};

function CardContrato({
  contrato: c,
  onEditar,
  onExcluir,
  onAlternar,
}: {
  contrato: Contrato;
  onEditar: () => void;
  onExcluir: () => void;
  onAlternar: (p: Mensalidade) => void;
}) {
  const inclusos = [
    c.incluiInternet ? 'Internet' : null,
    c.incluiAgua ? 'Água' : null,
    c.incluiEnergia ? 'Energia' : null,
  ].filter(Boolean) as string[];

  const totalMes = c.valorMensal + c.outrosCustos;
  // Mais recentes primeiro na régua.
  const reguaDesc = [...c.mensalidades].reverse();

  return (
    <div className="flex flex-col rounded-carias border border-borda bg-superficie p-5 shadow-carias">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-tinta">
            {c.inquilinoNome}
          </h3>
          <div className="text-sm text-tinta-suave">{c.imovelNome}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            c.status === 'ATIVO'
              ? 'bg-areia text-mar'
              : 'bg-[#eee] text-tinta-suave'
          }`}
        >
          {c.status === 'ATIVO' ? 'Ativo' : 'Encerrado'}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Linha rotulo="Aluguel / mês" valor={brl(totalMes)} />
        {c.outrosCustos > 0 ? (
          <Linha
            rotulo={`• inclui outros custos${
              c.outrosCustosDescricao ? ` (${c.outrosCustosDescricao})` : ''
            }`}
            valor={brl(c.outrosCustos)}
            suave
          />
        ) : null}
        <Linha rotulo="Vencimento" valor={`dia ${c.diaVencimento}`} />
        <Linha
          rotulo="Período"
          valor={`${brDate(c.inicio)} → ${c.fim ? brDate(c.fim) : 'sem prazo'}`}
        />
        {c.inquilinoTelefone ? (
          <Linha rotulo="Telefone" valor={c.inquilinoTelefone} />
        ) : null}
      </dl>

      <div className="mt-3 text-sm">
        <span className="text-tinta-suave">Incluso no aluguel: </span>
        {inclusos.length ? (
          <span className="text-tinta">{inclusos.join(', ')}</span>
        ) : (
          <span className="text-tinta-suave">
            nada (água, luz e internet por conta do inquilino)
          </span>
        )}
      </div>

      {/* Régua de mensalidades */}
      <div className="mt-4">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-suave">
          Mensalidades
        </div>
        <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
          {reguaDesc.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-borda px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-tinta">
                  {brMesAno(p.competencia)}
                </div>
                <div className="text-xs text-tinta-suave">
                  vence {brDate(p.vencimento)} · {brl(p.valor)}
                  {p.pagoEm ? ` · pago ${brDate(p.pagoEm)}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    CHIP[p.situacao]
                  }`}
                >
                  {situacaoAluguelLabel(p.situacao)}
                </span>
                <button
                  onClick={() => onAlternar(p)}
                  className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                    p.status === 'PAGO'
                      ? 'border-borda-forte text-tinta-suave hover:bg-areia'
                      : 'border-[#2f9e6f] text-[#1f6b4a] hover:bg-[#dcefe5]'
                  }`}
                >
                  {p.status === 'PAGO' ? 'Reabrir' : 'Marcar pago'}
                </button>
              </div>
            </div>
          ))}
          {reguaDesc.length === 0 ? (
            <div className="text-sm text-tinta-suave">
              Sem mensalidades geradas ainda.
            </div>
          ) : null}
        </div>
      </div>

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

function Linha({
  rotulo,
  valor,
  suave,
}: {
  rotulo: string;
  valor: string;
  suave?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-tinta-suave">{rotulo}</dt>
      <dd className={suave ? 'text-tinta-suave' : 'font-semibold text-tinta'}>
        {valor}
      </dd>
    </div>
  );
}

function ModalContrato({
  titulo,
  form,
  setForm,
  imoveis,
  salvando,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  imoveis: Imovel[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
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
            <label className={rotulo}>Imóvel *</label>
            <select
              className={campo}
              value={form.propertyId}
              onChange={(e) =>
                setForm((f) => ({ ...f, propertyId: e.target.value }))
              }
            >
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={rotulo}>Nome do inquilino *</label>
            <input
              className={campo}
              value={form.inquilinoNome}
              onChange={(e) =>
                setForm((f) => ({ ...f, inquilinoNome: e.target.value }))
              }
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo}>Telefone</label>
              <input
                className={campo}
                value={form.inquilinoTelefone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, inquilinoTelefone: e.target.value }))
                }
                placeholder="(85) 9 9999-9999"
              />
            </div>
            <div>
              <label className={rotulo}>CPF</label>
              <input
                className={campo}
                value={form.inquilinoDocumento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, inquilinoDocumento: e.target.value }))
                }
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div>
            <label className={rotulo}>E-mail</label>
            <input
              className={campo}
              value={form.inquilinoEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, inquilinoEmail: e.target.value }))
              }
              placeholder="inquilino@email.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo}>Aluguel mensal (R$) *</label>
              <input
                type="number"
                step="0.01"
                className={campo}
                value={form.valorMensal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valorMensal: e.target.value }))
                }
                placeholder="0,00"
              />
            </div>
            <div>
              <label className={rotulo}>Dia do vencimento</label>
              <input
                type="number"
                min={1}
                max={28}
                className={campo}
                value={form.diaVencimento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, diaVencimento: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo}>Outros custos / mês (R$)</label>
              <input
                type="number"
                step="0.01"
                className={campo}
                value={form.outrosCustos}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outrosCustos: e.target.value }))
                }
                placeholder="0,00"
              />
            </div>
            <div>
              <label className={rotulo}>Descrição dos outros custos</label>
              <input
                className={campo}
                value={form.outrosCustosDescricao}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    outrosCustosDescricao: e.target.value,
                  }))
                }
                placeholder="Ex: condomínio"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo}>Início *</label>
              <input
                type="date"
                className={campo}
                value={form.inicio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, inicio: e.target.value }))
                }
              />
            </div>
            <div>
              <label className={rotulo}>Fim (opcional)</label>
              <input
                type="date"
                className={campo}
                value={form.fim}
                onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className={rotulo}>Já incluso no aluguel</label>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-tinta">
                <input
                  type="checkbox"
                  checked={form.incluiInternet}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, incluiInternet: e.target.checked }))
                  }
                />
                Internet
              </label>
              <label className="flex items-center gap-2 text-sm text-tinta">
                <input
                  type="checkbox"
                  checked={form.incluiAgua}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, incluiAgua: e.target.checked }))
                  }
                />
                Água
              </label>
              <label className="flex items-center gap-2 text-sm text-tinta">
                <input
                  type="checkbox"
                  checked={form.incluiEnergia}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, incluiEnergia: e.target.checked }))
                  }
                />
                Energia
              </label>
            </div>
            <p className="mt-1.5 text-xs text-tinta-suave">
              Marque o que já está embutido no valor do aluguel. O que não estiver
              marcado é por conta do inquilino.
            </p>
          </div>

          <div>
            <label className={rotulo}>Observações</label>
            <textarea
              rows={2}
              className={campo}
              value={form.observacoes}
              onChange={(e) =>
                setForm((f) => ({ ...f, observacoes: e.target.value }))
              }
              placeholder="Fiador, garantia, reajuste anual…"
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
