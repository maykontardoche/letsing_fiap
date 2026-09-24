import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { Plano } from '@prisma/client';

const aparar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emailNormalizado = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CadastroDto {
  @Transform(aparar)
  @IsString()
  @Length(2, 120, { message: 'O nome da organização deve ter entre 2 e 120 caracteres.' })
  nomeOrganizacao!: string;

  @Transform(aparar)
  @IsString()
  @Length(2, 120, { message: 'Seu nome deve ter entre 2 e 120 caracteres.' })
  nome!: string;

  @Transform(emailNormalizado)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(10, { message: 'A senha deve ter pelo menos 10 caracteres.' })
  @MaxLength(128)
  senha!: string;

  @IsOptional()
  @IsEnum(Plano, { message: 'Plano inválido.' })
  plano?: Plano;
}

export class EntrarDto {
  @Transform(emailNormalizado)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Informe a senha.' })
  @MaxLength(128)
  senha!: string;
}

export class DesafioMfaDto {
  /** 6 dígitos do app, ou um código de recuperação `XXXX-XXXX`. */
  @Transform(aparar)
  @IsString()
  @Length(6, 9, { message: 'Informe o código de 6 dígitos ou um código de recuperação.' })
  codigo!: string;
}

export class EsqueciSenhaDto {
  @Transform(emailNormalizado)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;
}

export class RedefinirSenhaDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,100}$/, { message: 'Link inválido ou incompleto.' })
  token!: string;

  @IsString()
  @MinLength(10, { message: 'A senha deve ter pelo menos 10 caracteres.' })
  @MaxLength(128)
  senha!: string;
}
