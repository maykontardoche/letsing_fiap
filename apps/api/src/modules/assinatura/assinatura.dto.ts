import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ACOES_DE_VIVACIDADE, GESTOS } from './desafios';

export class ConcluirCodigoDto {
  @IsUUID()
  desafio!: string;

  @Matches(/^\d{6}$/, { message: 'O código tem 6 dígitos.' })
  codigo!: string;
}

export class ConcluirVozDto {
  @IsUUID()
  desafio!: string;

  @IsString()
  @MaxLength(500)
  transcricao!: string;
}

export class ConcluirGestosDto {
  @IsUUID()
  desafio!: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(GESTOS, { each: true })
  gestos!: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(1, { each: true })
  confiancas!: number[];
}

class MedicaoFacialDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(ACOES_DE_VIVACIDADE, { each: true })
  acoes!: string[];

  @IsInt()
  @Min(0)
  @Max(100_000)
  quadrosAnalisados!: number;

  @IsInt()
  @Min(0)
  @Max(100_000)
  quadrosComRosto!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  confiancaMedia!: number;

  @IsBoolean()
  rostosMultiplos!: boolean;
}

export class ConcluirFacialDto {
  @IsUUID()
  desafio!: string;

  @ValidateNested()
  @Type(() => MedicaoFacialDto)
  medicao!: MedicaoFacialDto;
}

/** Tamanho máximo da rubrica em data URL (≈ 300 KB). */
const LIMITE_DA_IMAGEM = 400_000;

export class AssinarDto {
  @IsIn(['desenhada', 'digitada'])
  tipo!: 'desenhada' | 'digitada';

  @IsString()
  @MaxLength(LIMITE_DA_IMAGEM, { message: 'A imagem da assinatura é grande demais.' })
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, { message: 'Imagem de assinatura inválida.' })
  imagem!: string;

  /** Concordância explícita com o conteúdo — sem isso, não há manifestação de vontade. */
  @Equals(true, { message: 'É preciso concordar com o conteúdo do documento para assinar.' })
  aceite!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;
}

export class RecusarDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 500, { message: 'Conte o motivo da recusa em 5 a 500 caracteres.' })
  motivo!: string;
}
