import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigurado } from '@/lib/supabase/env';

// Página privada — renderizada a cada acesso (lê o login do usuário).
export const dynamic = 'force-dynamic';

const NAV = [
  { rotulo: 'Painel', ativo: true },
  { rotulo: 'Imóveis', ativo: false },
  { rotulo: 'Reservas', ativo: false },
  { rotulo: 'Agenda', ativo: false },
  { rotulo: 'Custos', ativo: false },
  { rotulo: 'Plataformas', ativo: false },
];

export default async function PainelPage() {
  let email: string | null = null;

  if (supabaseConfigurado) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Barra lateral */}
      <aside className="w-[230px] shrink-0 bg-mar text-[#eafcff] p-5 flex flex-col gap-1.5">
        <div className="px-2 pb-5 pt-1">
          <span className="font-display text-2xl font-semibold text-white">
            C. Arias
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.rotulo}
              className={`text-left rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                item.ativo
                  ? 'bg-coral text-white'
                  : 'text-[#cdeef2] hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.rotulo}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-4">
          <Link
            href="/sair"
            className="text-xs text-[#bfe3e8] underline hover:text-white"
          >
            Sair
          </Link>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-tinta">
            Painel
          </h1>
          <p className="text-tinta-suave mt-1">
            {email ? (
              <>
                Você está logado como <strong>{email}</strong>.
              </>
            ) : (
              'Fundação no ar — falta ligar a conta do Supabase.'
            )}
          </p>
        </header>

        <section className="bg-superficie border border-borda rounded-carias shadow-carias p-7 max-w-xl">
          <h2 className="font-display text-xl font-semibold text-tinta mb-2">
            🎉 Olá, mundo!
          </h2>
          <p className="text-tinta-suave leading-relaxed">
            A fundação do SaaS está funcionando: o site (Next.js), o login
            (Supabase) e a API (NestJS + banco PostgreSQL) já estão conectados.
            A partir daqui começamos a <strong>Fase B</strong>, reproduzindo as
            telas do protótipo: Imóveis, Reservas, Custos, Agenda, Painel e
            Plataformas.
          </p>
        </section>
      </main>
    </div>
  );
}
