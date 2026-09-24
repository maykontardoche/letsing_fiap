/**
 * Ambiente determinístico dos testes, aplicado **antes** de qualquer módulo ser
 * importado — o `ConfigModule` valida no import.
 *
 * ⚠️ Banco e Redis são **forçados** para os de teste (atribuição, não `??=`): o
 * `.env` de desenvolvimento já os definiu, e é exatamente o valor dele que não
 * pode valer aqui. Sem isso, a suíte apagaria os dados de demonstração.
 */
import { config } from 'dotenv';

config({ quiet: true });

const base = process.env.DATABASE_URL ?? 'postgresql://letssign:letssign@localhost:5452/letssign';
const url = new URL(base);

url.pathname = '/letssign_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = url.toString();
// Banco lógico 1 do Redis: as sessões de desenvolvimento ficam no 0.
process.env.REDIS_URL = `${(process.env.REDIS_URL ?? 'redis://localhost:6392').replace(/\/\d+$/, '')}/1`;
process.env.LOG_LEVEL = 'silent';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DIRETORIO_DE_ARMAZENAMENTO = './storage-de-teste';
process.env.WORKER_EMBUTIDO = 'false';
process.env.APP_URL = 'http://localhost:5190';
process.env.CORS_ORIGINS = 'http://localhost:5190';
delete process.env.SMTP_URL;
delete process.env.CHAVE_PRIVADA_ED25519;
