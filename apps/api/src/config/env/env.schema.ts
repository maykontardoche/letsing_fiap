import { z } from 'zod';

const MIN_PORTA = 1;
const MAX_PORTA = 65535;

/** Lista separada por vírgula → array sem vazios. */
const lista = (padrao: string) =>
  z
    .string()
    .default(padrao)
    .transform((valor) =>
      valor
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    );

/**
 * Contrato das variáveis de ambiente — a ÚNICA definição do que a aplicação
 * aceita. É validado na subida: env faltando ou malformada derruba o processo
 * com a lista completa de problemas, em vez de virar `undefined` no meio de uma
 * requisição de assinatura.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(MIN_PORTA).max(MAX_PORTA).default(3020),

  DATABASE_URL: z
    .string()
    .min(1)
    .refine((valor) => valor.startsWith('postgres://') || valor.startsWith('postgresql://'), {
      message: 'DATABASE_URL deve ser uma URL PostgreSQL',
    }),

  /** Sessão server-side, throttle de login e fila BullMQ. */
  REDIS_URL: z
    .string()
    .min(1)
    .refine((valor) => valor.startsWith('redis://') || valor.startsWith('rediss://'), {
      message: 'REDIS_URL deve ser uma URL Redis',
    }),

  /** Origens aceitas pelo CORS e pela checagem de origem das mutações. */
  CORS_ORIGINS: lista('http://localhost:5190'),

  /** Onde o SPA está. Os links de convite e de validação apontam para cá. */
  APP_URL: z.string().url().default('http://localhost:5190'),

  /**
   * SMTP. ⚠️ Opcional de propósito: sem ele, o e-mail é registrado no log em
   * vez de enviado. Em desenvolvimento o docker-compose sobe o Mailpit.
   */
  SMTP_URL: z.string().min(1).optional(),
  EMAIL_REMETENTE: z.string().min(1).default('LetsSign <nao-responda@letssign.dev>'),

  /** Disco privado dos PDFs. Não há URL pública para ele. */
  DIRETORIO_DE_ARMAZENAMENTO: z.string().min(1).default('./storage'),

  /**
   * 🔐 Chave da cifra de campo em repouso (CPF, segredo de MFA). 32 bytes em
   * hexadecimal. Gere com: `openssl rand -hex 32`.
   */
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes)'),

  /**
   * 🔐 Chave privada Ed25519 da plataforma (PEM PKCS#8, em base64).
   *
   * ⚠️ Opcional só fora de produção: sem ela, uma chave é gerada na primeira
   * subida e guardada em `DIRETORIO_DE_ARMAZENAMENTO/chaves/`. Em produção a
   * ausência derruba o boot — trocar a chave silenciosamente invalidaria a
   * verificação de todo documento já assinado.
   */
  CHAVE_PRIVADA_ED25519: z.string().min(1).optional(),

  MFA_EMISSOR: z.string().min(1).default('LetsSign'),

  /** Rate limit global por IP (requisições por janela). */
  THROTTLE_TTL_SEGUNDOS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMITE: z.coerce.number().int().positive().default(300),

  /** Tamanho máximo do PDF aceito no upload. */
  TAMANHO_MAXIMO_PDF_MB: z.coerce.number().int().positive().max(50).default(20),

  /** Liga o consumidor da fila de e-mail neste processo. */
  WORKER_EMBUTIDO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida o ambiente e devolve o objeto tipado. Lança com a lista **completa** de
 * problemas: uma variável errada não deve esconder as outras.
 */
export function validarAmbiente(fonte: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(fonte);

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Configuração de ambiente inválida:\n${problemas}`);
  }

  if (resultado.data.NODE_ENV === 'production' && !resultado.data.CHAVE_PRIVADA_ED25519) {
    throw new Error(
      'Configuração de ambiente inválida:\n  - CHAVE_PRIVADA_ED25519: obrigatória em produção',
    );
  }

  return resultado.data;
}
