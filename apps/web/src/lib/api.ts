'use client';

import { createClient } from '@/lib/supabase/client';
import { supabaseConfigurado } from '@/lib/supabase/env';

// Endereço da API (cérebro). Em produção vem do ambiente; local cai no 3333.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

// Erro de API com o código HTTP, para a tela reagir (ex.: 401 = login expirado).
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Pega o token de login do Supabase para autenticar a chamada na API.
async function getToken(): Promise<string | null> {
  if (!supabaseConfigurado) return null;
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Falha de rede = API fora do ar / sem internet.
    throw new ApiError('Não foi possível falar com a API.', 0);
  }

  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const j = await res.json();
      msg = Array.isArray(j.message)
        ? j.message.join(', ')
        : j.message || msg;
    } catch {
      // resposta sem corpo JSON — mantém a mensagem padrão
    }
    throw new ApiError(msg, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
