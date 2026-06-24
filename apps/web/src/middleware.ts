import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_TOKEN } from '@/lib/config';

// Protege as páginas privadas: sem token de login → manda para /entrar.
export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_TOKEN)?.value;
  const path = request.nextUrl.pathname;

  const ehAreaPrivada =
    path === '/' ||
    path.startsWith('/painel') ||
    path.startsWith('/imoveis') ||
    path.startsWith('/reservas') ||
    path.startsWith('/alugueis') ||
    path.startsWith('/agenda') ||
    path.startsWith('/custos') ||
    path.startsWith('/plataformas');

  if (!token && ehAreaPrivada) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    return NextResponse.redirect(url);
  }

  // Já logado abrindo a tela de login → vai direto para o painel.
  if (token && path === '/entrar') {
    const url = request.nextUrl.clone();
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Roda em todas as rotas, exceto arquivos estáticos e imagens.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
