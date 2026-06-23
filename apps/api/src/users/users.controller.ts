import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, AuthUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o usuário logado. Garante o registro local (multi-tenant:
   * tudo pertence a ele). Normalmente já existe, criado no cadastro.
   */
  @Get()
  async me(@CurrentUser() logado: AuthUser) {
    const email = logado.email ?? `${logado.id}@sem-email.local`;

    const user = await this.prisma.user.upsert({
      where: { id: logado.id },
      update: { email },
      create: {
        id: logado.id,
        email,
        nome: email.split('@')[0],
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
