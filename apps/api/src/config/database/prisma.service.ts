import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { criarExtensaoDeOrganizacao } from '../../common/tenancy/tenant-extension';
import { EnvService } from '../env/env.service';

/** Função nomeada para o TypeScript derivar o tipo do client estendido. */
function estender(cru: PrismaClient) {
  return cru.$extends(criarExtensaoDeOrganizacao());
}

/** O client **com** o escopo de organização aplicado. É o único tipo que sai daqui. */
export type ClienteEscopado = ReturnType<typeof estender>;

/** O client de dentro de uma transação interativa, também escopado. */
export type TransacaoEscopada = Parameters<Parameters<ClienteEscopado['$transaction']>[0]>[0];

/**
 * Acesso ao PostgreSQL.
 *
 * ## Por que o client cru é privado
 *
 * ⚠️ A extensão de organização é o que impede vazamento de dado entre
 * empresas-clientes. Um client **sem** ela escapando para um repositório anularia
 * a camada inteira — sem sintoma nenhum: as queries continuariam funcionando, só
 * que devolvendo dados a mais.
 *
 * Por isso a classe **não estende** `PrismaClient`: existe **uma porta só**, `db`.
 * Para os casos legítimos que atravessam organizações, o caminho é o escape hatch
 * `semEscopoDeOrganizacao()`, e não um segundo client.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly cru: PrismaClient;

  readonly db: ClienteEscopado;

  constructor(env: EnvService) {
    this.cru = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });
    this.db = estender(this.cru);
  }

  async onModuleInit(): Promise<void> {
    await this.cru.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.cru.$disconnect();
  }
}
