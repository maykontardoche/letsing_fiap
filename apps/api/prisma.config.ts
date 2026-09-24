import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuração do Prisma CLI (migrate, generate, studio).
 *
 * A partir do Prisma 7 a URL de conexão sai do `schema.prisma` e vem para cá; o
 * `PrismaClient` em runtime recebe um driver adapter (ver `prisma.service.ts`).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://letssign:letssign@localhost:5452/letssign',
  },
});
