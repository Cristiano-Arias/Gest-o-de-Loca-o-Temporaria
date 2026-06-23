import { SignJWT, jwtVerify } from 'jose';

// Usuário logado, extraído do token (sub = id do usuário; email opcional).
export interface AuthUser {
  id: string;
  email?: string;
}

function segredo(): Uint8Array {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s) {
    throw new Error('AUTH_JWT_SECRET não configurado na API.');
  }
  return new TextEncoder().encode(s);
}

// Cria o token de acesso (validade de 30 dias), assinado com o segredo da API.
export async function assinarToken(
  userId: string,
  email: string,
): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(segredo());
}

// Confere a assinatura/validade do token e devolve o usuário.
export async function verificarToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, segredo());
  return {
    id: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}
