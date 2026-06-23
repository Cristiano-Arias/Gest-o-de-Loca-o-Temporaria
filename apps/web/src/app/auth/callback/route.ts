import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Recebe o usuário de volta após clicar no link mágico ou no login do Google,
// troca o "código" por uma sessão de login e leva para o painel.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const proximo = searchParams.get('next') ?? '/painel';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${proximo}`);
    }
  }

  // Algo deu errado: volta para o login.
  return NextResponse.redirect(`${origin}/entrar`);
}
