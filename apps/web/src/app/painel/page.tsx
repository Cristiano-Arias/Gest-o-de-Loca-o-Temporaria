import { AppShell } from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigurado } from '@/lib/supabase/env';

// Página privada — renderizada a cada acesso (lê o login do usuário).
export const dynamic = 'force-dynamic';

export default async function PainelPage() {
  let email: string | null = null;

  if (supabaseConfigurado) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  const subtitulo = email
    ? `Você está logado como ${email}.`
    : 'Fundação no ar — falta ligar a conta do Supabase.';

  return (
    <AppShell atual="painel" titulo="Painel" subtitulo={subtitulo}>
      <section className="bg-superficie border border-borda rounded-carias shadow-carias p-7 max-w-xl">
        <h2 className="font-display text-xl font-semibold text-tinta mb-2">
          🎉 Olá, mundo!
        </h2>
        <p className="text-tinta-suave leading-relaxed">
          A fundação do SaaS está funcionando: o site (Next.js), o login
          (Supabase) e a API (NestJS + banco PostgreSQL) já estão conectados. A
          tela de <strong>Imóveis</strong> já é a primeira da{' '}
          <strong>Fase B</strong> — use o menu à esquerda para abri-la.
        </p>
      </section>
    </AppShell>
  );
}
