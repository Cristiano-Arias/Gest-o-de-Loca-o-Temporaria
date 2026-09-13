import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from './logout-button';

type NavItem = { key: string; rotulo: string; href?: string };

// As telas com href já existem; as sem href ficam "Em breve" (próximas fases).
const NAV: NavItem[] = [
  { key: 'painel', rotulo: 'Painel', href: '/painel' },
  { key: 'imoveis', rotulo: 'Imóveis', href: '/imoveis' },
  { key: 'reservas', rotulo: 'Reservas', href: '/reservas' },
  { key: 'alugueis', rotulo: 'Aluguéis', href: '/alugueis' },
  { key: 'agenda', rotulo: 'Agenda', href: '/agenda' },
  { key: 'custos', rotulo: 'Custos', href: '/custos' },
  { key: 'plataformas', rotulo: 'Plataformas', href: '/plataformas' },
];

/**
 * Moldura das telas internas.
 *
 * No computador: barra lateral fixa, como sempre foi.
 * No celular: a lateral sai (ela sozinha comia metade de uma tela de 360px) e
 * o menu vira uma faixa de atalhos que rola na horizontal, grudada no topo.
 * Sete itens não cabem numa barra inferior com texto legível, e rolar na
 * horizontal é mais previsível do que um menu que abre e fecha.
 */
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
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* --- celular: topo com marca + atalhos --- */}
      <div className="sticky top-0 z-30 bg-mar text-[#eafcff] shadow-sm md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="font-display text-lg font-semibold text-white">
            C. Arias
          </span>
          <LogoutButton />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => {
            const ativo = item.key === atual;
            const base =
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition';
            return item.href ? (
              <Link
                key={item.key}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`${base} ${
                  ativo ? 'bg-coral text-white' : 'bg-white/10 text-[#cdeef2]'
                }`}
              >
                {item.rotulo}
              </Link>
            ) : (
              <span
                key={item.key}
                className={`${base} text-[#8fbcc1]`}
                title="Em breve"
              >
                {item.rotulo}
              </span>
            );
          })}
        </nav>
      </div>

      {/* --- computador: barra lateral --- */}
      <aside className="hidden w-[180px] shrink-0 flex-col gap-1 bg-mar p-3.5 text-[#eafcff] md:flex">
        <div className="px-2 pb-4 pt-1">
          <span className="font-display text-xl font-semibold text-white">
            C. Arias
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const ativo = item.key === atual;
            const base =
              'text-left rounded-lg px-2.5 py-2 text-sm font-medium transition';
            if (item.href) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={ativo ? 'page' : undefined}
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
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-6">
        <header className="mb-5 flex flex-col gap-3 md:mb-8 md:flex-row md:items-start md:justify-between md:gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-tinta md:text-3xl">
              {titulo}
            </h1>
            {subtitulo ? (
              <p className="mt-1 text-sm text-tinta-suave md:text-base">
                {subtitulo}
              </p>
            ) : null}
          </div>
          {acao}
        </header>
        {children}
      </main>
    </div>
  );
}
