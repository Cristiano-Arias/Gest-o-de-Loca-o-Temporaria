import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieParaDefinir = { name: string; value: string; options?: CookieOptions };
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigurado } from './env';

// Renova a sessão de login a cada navegação e protege as páginas privadas.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Sem Supabase configurado ainda: deixa passar (telas públicas só).
  if (!supabaseConfigurado) {
    return supabaseResponse;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieParaDefinir[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set({ name, value, ...options }),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const ehAreaPrivada = path === '/' || path.startsWith('/painel');

  // Não logado tentando acessar área privada → manda para o login.
  if (!user && ehAreaPrivada) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    return NextResponse.redirect(url);
  }

  // Já logado abrindo a tela de login → manda para o painel.
  if (user && path === '/entrar') {
    const url = request.nextUrl.clone();
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
