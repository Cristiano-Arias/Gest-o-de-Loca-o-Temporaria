'use client';

import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Resultado = {
  importadas: number;
  atualizadas: number;
  ignoradas: number;
  porPlataforma: {
    Airbnb: { nova: number; atu: number };
    'Booking.com': { nova: number; atu: number };
  };
  conflitos: string[];
  erros: string[];
};

export function ImportModal({
  onFechar,
  onConcluido,
}: {
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function importar() {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) {
      setErro('Selecione ao menos um arquivo.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const r = await api.upload<Resultado>('/import', fd);
      setResultado(r);
      onConcluido(); // recarrega a lista de reservas por trás
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erro ao importar.';
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

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
            {resultado ? 'Importação concluída' : 'Importar reservas'}
          </h2>
          <button
            onClick={onFechar}
            className="text-tinta-suave hover:text-tinta"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {!resultado ? (
          <div className="space-y-4">
            <p className="text-sm text-tinta-suave">
              Selecione os relatórios baixados das plataformas. O sistema detecta
              sozinho se é Airbnb ou Booking, identifica o imóvel e{' '}
              <strong>não duplica</strong> reservas já importadas (pelo código).
            </p>
            <div>
              <label className="block text-sm font-medium text-tinta">
                Arquivos (Airbnb .csv e/ou Booking .xls)
              </label>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                multiple
                className="mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta file:mr-3 file:rounded-md file:border-0 file:bg-areia file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-tinta"
              />
              <p className="mt-1 text-xs text-tinta-suave">
                Pode selecionar vários de uma vez. Airbnb = um arquivo com os
                dois imóveis · Booking = um arquivo por imóvel.
              </p>
            </div>
            {erro ? (
              <p className="rounded-lg border border-vermelho/30 bg-vermelho/10 p-3 text-sm text-vermelho">
                {erro}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={onFechar}
                disabled={enviando}
                className="rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium text-tinta hover:bg-areia disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={importar}
                disabled={enviando}
                className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral-escuro disabled:opacity-50"
              >
                {enviando ? 'Processando…' : 'Importar'}
              </button>
            </div>
          </div>
        ) : (
          <ResumoImport resultado={resultado} onFechar={onFechar} />
        )}
      </div>
    </div>
  );
}

function ResumoImport({
  resultado: r,
  onFechar,
}: {
  resultado: Resultado;
  onFechar: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Quadro rotulo="Importadas" valor={r.importadas} cor="text-verde" />
        <Quadro rotulo="Atualizadas" valor={r.atualizadas} />
        <Quadro rotulo="Ignoradas" valor={r.ignoradas} />
      </div>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-borda">
            <td className="py-1.5 text-tinta">Airbnb</td>
            <td className="py-1.5 text-right text-tinta-suave">
              {r.porPlataforma.Airbnb.nova} novas ·{' '}
              {r.porPlataforma.Airbnb.atu} atualizadas
            </td>
          </tr>
          <tr>
            <td className="py-1.5 text-tinta">Booking.com</td>
            <td className="py-1.5 text-right text-tinta-suave">
              {r.porPlataforma['Booking.com'].nova} novas ·{' '}
              {r.porPlataforma['Booking.com'].atu} atualizadas
            </td>
          </tr>
        </tbody>
      </table>

      {r.conflitos.length ? (
        <div className="rounded-lg border border-vermelho/30 bg-vermelho/10 p-3">
          <strong className="text-sm text-vermelho">
            ⚠ {r.conflitos.length} conflito(s) de agenda (possível overbooking):
          </strong>
          <ul className="mt-2 list-disc pl-5 text-xs text-vermelho">
            {r.conflitos.slice(0, 8).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          {r.conflitos.length > 8 ? (
            <div className="mt-1 text-xs text-vermelho">
              …e mais {r.conflitos.length - 8}.
            </div>
          ) : null}
        </div>
      ) : null}

      {r.erros.length ? (
        <p className="text-xs text-tinta-suave">
          Avisos: {r.erros.join(' · ')}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          onClick={onFechar}
          className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral-escuro"
        >
          Pronto
        </button>
      </div>
    </div>
  );
}

function Quadro({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: number;
  cor?: string;
}) {
  return (
    <div className="rounded-carias border border-borda bg-superficie p-3 text-center">
      <div className="text-xs text-tinta-suave">{rotulo}</div>
      <div className={`font-display text-2xl font-semibold ${cor ?? 'text-tinta'}`}>
        {valor}
      </div>
    </div>
  );
}
