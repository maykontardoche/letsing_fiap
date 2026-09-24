import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NivelDeVerificacao, StatusDoDocumento } from '@prisma/client';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const inteiro = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

export class CriarDocumentoDto {
  @Transform(aparar)
  @IsString()
  @Length(3, 160, { message: 'O título deve ter entre 3 e 160 caracteres.' })
  titulo!: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(1000, { message: 'A mensagem pode ter até 1000 caracteres.' })
  mensagem?: string;
}

export class AtualizarDocumentoDto {
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @Length(3, 160, { message: 'O título deve ter entre 3 e 160 caracteres.' })
  titulo?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(1000)
  mensagem?: string | null;

  @IsOptional()
  @IsEnum(NivelDeVerificacao, { message: 'Nível de verificação inválido.' })
  nivelVerificacao?: NivelDeVerificacao;

  @IsOptional()
  @IsBoolean()
  ordemSequencial?: boolean;

  /** ISO-8601. `null` remove o prazo. */
  @IsOptional()
  @IsDateString({}, { message: 'Prazo inválido.' })
  prazo?: string | null;
}

export class SignatarioDto {
  @Transform(aparar)
  @IsString()
  @Length(2, 120, { message: 'O nome do signatário deve ter entre 2 e 120 caracteres.' })
  nome!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Há um e-mail de signatário inválido.' })
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;
}

export class DefinirSignatariosDto {
  @ValidateNested({ each: true })
  @Type(() => SignatarioDto)
  @ArrayMinSize(1, { message: 'Adicione pelo menos um signatário.' })
  @ArrayMaxSize(20, { message: 'Um documento pode ter até 20 signatários.' })
  signatarios!: SignatarioDto[];
}

export class CancelarDocumentoDto {
  @Transform(aparar)
  @IsString()
  @Length(5, 500, { message: 'Explique o motivo em 5 a 500 caracteres.' })
  motivo!: string;
}

const ORDENACOES = ['criadoEm', 'atualizadoEm', 'titulo', 'prazo'] as const;

export type Ordenacao = (typeof ORDENACOES)[number];

/**
 * ⚠️ A querystring é entrada do usuário: valor inválido cai no padrão do lado do
 * SPA, mas aqui ele é **recusado** — a API não adivinha.
 */
export class ListarDocumentosDto {
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(StatusDoDocumento)
  status?: StatusDoDocumento;

  @IsOptional()
  @IsIn(ORDENACOES)
  ordenar?: Ordenacao;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @Transform(inteiro)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Transform(inteiro)
  @IsInt()
  @Min(1)
  @Max(100)
  por?: number;
}
