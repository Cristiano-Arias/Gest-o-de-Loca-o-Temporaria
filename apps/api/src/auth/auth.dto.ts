import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterInput {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres.' })
  @MaxLength(100)
  senha!: string;
}

export class LoginInput {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  senha!: string;
}
