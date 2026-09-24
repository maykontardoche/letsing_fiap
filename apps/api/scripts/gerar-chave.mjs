// Imprime a chave privada Ed25519 da plataforma no formato de CHAVE_PRIVADA_ED25519
// (PEM PKCS#8 em base64, numa linha só).
//
//   node scripts/gerar-chave.mjs              → gera um par NOVO
//   node scripts/gerar-chave.mjs --existente  → reaproveita a chave de desenvolvimento
//                                                (storage/chaves/plataforma-ed25519.pem)
//
// ⚠️ Esta chave É a identidade criptográfica do LetsSign: todo documento assinado é
// verificado contra ela. Guarde-a num cofre de segredos; perdê-la ou trocá-la sem
// rotação impede verificar o que já foi assinado.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arquivoDeDev = resolve(import.meta.dirname, '..', 'storage', 'chaves', 'plataforma-ed25519.pem');
let pem;

if (process.argv.includes('--existente')) {
  if (!existsSync(arquivoDeDev)) {
    process.stderr.write(`Nenhuma chave em ${arquivoDeDev}. Suba a API uma vez (npm run dev) para gerá-la.\n`);
    process.exit(1);
  }

  pem = readFileSync(arquivoDeDev, 'utf8');
} else {
  pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

const publica = createPublicKey(createPrivateKey(pem));
const id = createHash('sha256').update(publica.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);

process.stdout.write(`# id da chave: ${id}\nCHAVE_PRIVADA_ED25519=${Buffer.from(pem).toString('base64')}\n`);
