import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieParaDefinir = { name: string; value: string; options?: CookieOptions };
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

// Cliente Supabase para uso no servidor (Server Components e Route Handlers).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieParaDefinir[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...options }),
          );
        } catch {
          // Chamado de um Server Component (sem permissão de escrever cookie).
          // O middleware cuida de renovar a sessão — pode ignorar.
        }
      },
    },
  });
}
