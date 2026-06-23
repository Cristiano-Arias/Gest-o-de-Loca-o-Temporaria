import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseUser } from './supabase-auth.guard';

// Atalho para pegar o usuário logado dentro de um controller:
//   metodo(@CurrentUser() user: SupabaseUser) { ... }
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupabaseUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: SupabaseUser }>();
    return req.user;
  },
);
