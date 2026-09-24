import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
// Efeito colateral de propósito: resolve as URLs de teste exatamente como a suíte vai resolvê-las.
import './setup-env';

/**
 * Prepara o banco de teste antes da suíte: cria o database se não existe e
 * aplica as migrations (`migrate deploy` — nunca gera migration nova).
 *
 * Sem isto, o primeiro `npm test` numa máquina nova falharia com "database does
 * not exist" — ou, pior, alguém "resolveria" apontando o teste para o banco de dev.
 */
export default async function prepararBancoDeTeste(): Promise<void> {
  const url = process.env.DATABASE_URL as string;
  const nome = new URL(url).pathname.slice(1);

  if (!nome.endsWith('_test'))
    throw new Error(`Recusando rodar a suíte num banco que não é de teste: ${nome}`);

  const manutencao = new URL(url);

  manutencao.pathname = '/postgres';

  const cliente = new Client({ connectionString: manutencao.toString() });

  await cliente.connect();

  try {
    const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);

    if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE "${nome.replace(/"/g, '""')}"`);
  } finally {
    await cliente.end();
  }

  execFileSync(
    process.execPath,
    [resolve(require.resolve('prisma/build/index.js')), 'migrate', 'deploy'],
    {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    },
  );
}
