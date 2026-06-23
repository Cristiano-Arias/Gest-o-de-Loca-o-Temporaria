'use client';

import { useState } from 'react';
import { entrar, cadastrar } from '@/lib/auth';

export default function EntrarPage() {
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (modo === 'cadastro') {
        await cadastrar(nome.trim(), email.trim(), senha);
      } else {
        await entrar(email.trim(), senha);
      }
      // Recarrega para o painel já com o cookie de login válido.
      window.location.href = '/painel';
    } catch (err) {
      setErro((err as Error).message ?? 'Não foi possível entrar.');
      setEnviando(false);
    }
  }

  const campo =
    'mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-tinta outline-none focus:border-mar';

  return (
    <main className="flex min-h-screen items-center justify-center bg-mar p-6">
      <div className="w-full max-w-md rounded-carias border border-borda bg-superficie p-8 shadow-carias">
        <div className="mb-7 text-center">
          <h1 className="font-display text-3xl font-semibold text-tinta">
            C. Arias
          </h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Gestão de locação por temporada
          </p>
        </div>

        {/* alternador login / cadastro */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-borda bg-areia p-1">
          {(['login', 'cadastro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModo(m);
                setErro(null);
              }}
              className={`rounded-md py-1.5 text-sm font-medium transition ${
                modo === m
                  ? 'bg-superficie text-tinta shadow-sm'
                  : 'text-tinta-suave hover:text-tinta'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={enviar} className="space-y-4">
          {modo === 'cadastro' ? (
            <label className="block text-sm font-semibold text-tinta">
              Nome
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className={campo}
              />
            </label>
          ) : null}

          <label className="block text-sm font-semibold text-tinta">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className={campo}
            />
          </label>

          <label className="block text-sm font-semibold text-tinta">
            Senha
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={modo === 'cadastro' ? 'Ao menos 6 caracteres' : '••••••••'}
              className={campo}
            />
          </label>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-coral py-2.5 font-semibold text-white transition hover:bg-coral-escuro disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando
              ? 'Aguarde…'
              : modo === 'cadastro'
                ? 'Criar conta e entrar'
                : 'Entrar'}
          </button>
        </form>

        {erro ? (
          <p className="mt-4 rounded-lg border border-vermelho/30 bg-vermelho/10 p-3 text-sm text-vermelho">
            {erro}
          </p>
        ) : null}
      </div>
    </main>
  );
}
