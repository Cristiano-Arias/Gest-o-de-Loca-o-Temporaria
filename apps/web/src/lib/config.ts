// Endereço da API (cérebro). Em produção vem do ambiente; local cai no 3333.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

// Nome do cookie onde guardamos o token de login.
export const COOKIE_TOKEN = 'carias_token';
