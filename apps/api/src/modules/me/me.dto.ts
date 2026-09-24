import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class AtualizarPerfilDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120, { message: 'O nome deve ter entre 2 e 120 caracteres.' })
  nome!: string;
}

export class TrocarSenhaDto {
  @IsString()
  @MinLength(1, { message: 'Informe a senha atual.' })
  @MaxLength(128)
  senhaAtual!: string;

  @IsString()
  @MinLength(10, { message: 'A nova senha deve ter pelo menos 10 caracteres.' })
  @MaxLength(128)
  novaSenha!: string;
}

export class CodigoMfaDto {
  @IsString()
  @Length(6, 8, { message: 'Informe o código de 6 dígitos do app autenticador.' })
  codigo!: string;
}

export class DesativarMfaDto {
  @IsString()
  @MinLength(1, { message: 'Informe sua senha para desativar o MFA.' })
  @MaxLength(128)
  senha!: string;
}
