import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { jwtVerify } from 'jose';

export interface SupabaseUser {
  id: string; // sub do token = id do usuário no Supabase
  email?: string;
  phone?: string;
}

/**
 * Porteiro da API: confere o token de login emitido pelo Supabase.
 * O site envia o token no cabeçalho "Authorization: Bearer <token>".
 * Aqui validamos a assinatura usando o SUPABASE_JWT_SECRET.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    const token = header.slice('Bearer '.length).trim();
    const secret = process.env.SUPABASE_JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedException(
        'SUPABASE_JWT_SECRET não configurado na API.',
      );
    }

    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
      );

      const user: SupabaseUser = {
        id: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : undefined,
        phone: typeof payload.phone === 'string' ? payload.phone : undefined,
      };

      // Anexa o usuário à requisição para os controllers usarem.
      (req as Request & { user?: SupabaseUser }).user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
