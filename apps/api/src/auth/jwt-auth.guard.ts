import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verificarToken, AuthUser } from './jwt';

// Reexporta o tipo para os controllers usarem com um import só.
export type { AuthUser } from './jwt';

/**
 * Porteiro da API: confere o token de login (emitido pela nossa própria API).
 * O site envia o token no cabeçalho "Authorization: Bearer <token>".
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      const user = await verificarToken(token);
      (req as Request & { user?: AuthUser }).user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
  }
}
