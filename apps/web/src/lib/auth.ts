'use client';

import { API_URL, COOKIE_TOKEN } from './config';

const TRINTA_DIAS = 60 * 60 * 24 * 30;

// Guarda o token de login num cookie (lido pelo site e pelo middleware).
export function setToken(token: string) {
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie = `${COOKIE_TOKEN}=${token}; path=/; max-age=${TRINTA_DIAS}; SameSite=Lax${secure}`;
}

export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_TOKEN}=([^;]*)`),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export function clearToken() {
  document.cookie = `${COOKIE_TOKEN}=; path=/; max-age=0; SameSite=Lax`;
}

// --- chamadas públicas de login ---------------------------------------

async function authRequest(
  caminho: 'login' | 'register',
  body: Record<string, string>,
) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Não foi possível falar com a API. Ela já está no ar?');
  }
  if (!res.ok) {
    let msg = 'Não foi possível entrar.';
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message.join(', ') : j.message || msg;
    } catch {
      // sem corpo JSON
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { token: string };
  setToken(data.token);
  return data;
}

export function entrar(email: string, senha: string) {
  return authRequest('login', { email, senha });
}

export function cadastrar(nome: string, email: string, senha: string) {
  return authRequest('register', { nome, email, senha });
}
