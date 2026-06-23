import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard, SupabaseUser } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o usuário logado. Se for o primeiro acesso, cria o registro
   * local ligado à conta do Supabase (multi-tenant: tudo pertence a ele).
   */
  @Get()
  async me(@CurrentUser() supaUser: SupabaseUser) {
    const email = supaUser.email ?? `${supaUser.id}@sem-email.local`;

    const user = await this.prisma.user.upsert({
      where: { id: supaUser.id },
      update: { email },
      create: {
        id: supaUser.id,
        email,
        nome: email.split('@')[0],
        telefone: supaUser.phone ?? null,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        criadoEm: true,
      },
    });

    return user;
  }
}
