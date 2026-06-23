'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { supabaseConfigurado } from '@/lib/supabase/env';

export default function EntrarPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined;

  async function enviarLinkMagico(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setMensagem(
        'Pronto! Enviamos um link de acesso para o seu email. Abra-o para entrar.',
      );
    } catch (err) {
      setErro((err as Error).message ?? 'Não foi possível enviar o link.');
    } finally {
      setEnviando(false);
    }
  }

  async function entrarComGoogle() {
    setErro(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err) {
      setErro((err as Error).message ?? 'Não foi possível abrir o Google.');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-mar">
      <div className="w-full max-w-md bg-superficie rounded-carias shadow-carias border border-borda p-8">
        <div className="text-center mb-7">
          <h1 className="font-display text-3xl font-semibold text-tinta">
            C. Arias
          </h1>
          <p className="text-tinta-suave mt-1 text-sm">
            Gestão de locação por temporada
          </p>
        </div>

        {!supabaseConfigurado && (
          <div className="mb-6 rounded-xl border border-ambar/40 bg-ambar/10 p-4 text-sm text-tinta">
            <strong>Login ainda não configurado.</strong> Assim que a conta do
            Supabase for ligada (chaves no <code>.env</code>), os botões abaixo
            passam a funcionar.
          </div>
        )}

        <button
          onClick={entrarComGoogle}
          disabled={!supabaseConfigurado}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-borda-forte bg-white py-2.5 font-semibold text-tinta hover:bg-areia disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <span aria-hidden>🔵</span> Entrar com Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <span className="h-px flex-1 bg-borda" />
          <span className="text-xs text-tinta-suave">ou</span>
          <span className="h-px flex-1 bg-borda" />
        </div>

        <form onSubmit={enviarLinkMagico} className="space-y-3">
          <label className="block text-sm font-semibold text-tinta">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              disabled={!supabaseConfigurado}
              className="mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-tinta outline-none focus:border-mar disabled:opacity-50"
            />
          </label>
          <button
            type="submit"
            disabled={!supabaseConfigurado || enviando}
            className="w-full rounded-lg bg-coral py-2.5 font-semibold text-white hover:bg-coral-escuro disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {enviando ? 'Enviando…' : 'Enviar link mágico por email'}
          </button>
        </form>

        {mensagem && (
          <p className="mt-4 rounded-lg bg-verde/10 border border-verde/30 p-3 text-sm text-verde">
            {mensagem}
          </p>
        )}
        {erro && (
          <p className="mt-4 rounded-lg bg-vermelho/10 border border-vermelho/30 p-3 text-sm text-vermelho">
            {erro}
          </p>
        )}
      </div>
    </main>
  );
}
