import { NextResponse } from 'next/server';
import { COOKIE_TOKEN } from '@/lib/config';

// Logout: apaga o cookie do token e volta para a tela de login.
export function GET(request: Request) {
  const { origin } = new URL(request.url);
  const res = NextResponse.redirect(`${origin}/entrar`);
  res.cookies.set(COOKIE_TOKEN, '', { maxAge: 0, path: '/' });
  return res;
}
