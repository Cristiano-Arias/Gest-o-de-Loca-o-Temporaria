// Lê as chaves do Supabase do ambiente.
// Enquanto a conta Supabase não estiver configurada, estas ficam vazias —
// e o app mostra um aviso amigável em vez de quebrar.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
