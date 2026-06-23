import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginInput, RegisterInput } from './auth.dto';

// Rotas públicas de login (não exigem token).
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterInput) {
    return this.service.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginInput) {
    return this.service.login(dto);
  }
}
