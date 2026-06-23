import Link from 'next/link';
import type { ReactNode } from 'react';

type NavItem = { key: string; rotulo: string; href?: string };

// As telas com href já existem; as sem href ficam "Em breve" (próximas fases).
const NAV: NavItem[] = [
  { key: 'painel', rotulo: 'Painel', href: '/painel' },
  { key: 'imoveis', rotulo: 'Imóveis', href: '/imoveis' },
  { key: 'reservas', rotulo: 'Reservas', href: '/reservas' },
  { key: 'agenda', rotulo: 'Agenda' },
  { key: 'custos', rotulo: 'Custos', href: '/custos' },
  { key: 'fixos', rotulo: 'Custos fixos' },
  { key: 'plataformas', rotulo: 'Plataformas' },
];

// Moldura padrão das telas internas: barra lateral "C. Arias" + cabeçalho.
export function AppShell({
  atual,
  titulo,
  subtitulo,
  acao,
  children,
}: {
  atual: string;
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-[230px] shrink-0 bg-mar text-[#eafcff] p-5 flex flex-col gap-1.5">
        <div className="px-2 pb-5 pt-1">
          <span className="font-display text-2xl font-semibold text-white">
            C. Arias
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const ativo = item.key === atual;
            const base =
              'text-left rounded-lg px-3 py-2.5 text-sm font-medium transition';
            if (item.href) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`${base} ${
                    ativo
                      ? 'bg-coral text-white'
                      : 'text-[#cdeef2] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.rotulo}
                </Link>
              );
            }
            return (
              <span
                key={item.key}
                title="Em breve"
                className={`${base} text-[#8fbcc1] cursor-not-allowed`}
              >
                {item.rotulo}
              </span>
            );
          })}
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

      <main className="flex-1 p-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-tinta">
              {titulo}
            </h1>
            {subtitulo ? (
              <p className="text-tinta-suave mt-1">{subtitulo}</p>
            ) : null}
          </div>
          {acao}
        </header>
        {children}
      </main>
    </div>
  );
}
