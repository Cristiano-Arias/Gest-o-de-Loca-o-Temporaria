import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Encerra a sessão (logout) e volta para a tela de login.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/entrar`);
}
