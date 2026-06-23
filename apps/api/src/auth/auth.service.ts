import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { assinarToken } from './jwt';
import { LoginInput, RegisterInput } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // Cria uma conta nova (e-mail único) e já devolve o token de acesso.
  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    const existe = await this.prisma.user.findUnique({ where: { email } });
    if (existe) {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }
    const senhaHash = await bcrypt.hash(input.senha, 10);
    const user = await this.prisma.user.create({
      data: { nome: input.nome.trim(), email, senhaHash },
    });
    return this.resposta(user.id, user.nome, user.email);
  }

  // Confere e-mail + senha e devolve o token de acesso.
  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.senhaHash) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const ok = await bcrypt.compare(input.senha, user.senhaHash);
    if (!ok) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    return this.resposta(user.id, user.nome, user.email);
  }

  private async resposta(id: string, nome: string, email: string) {
    const token = await assinarToken(id, email);
    return { token, user: { id, nome, email } };
  }
}
