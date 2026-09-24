import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';
import { AssinadorEd25519 } from './assinador-ed25519';

/**
 * Carrega (ou, fora de produção, gera e guarda) a chave Ed25519 da plataforma.
 *
 * ⚠️ A chave é a identidade criptográfica do LetsSign: todo documento já
 * assinado é verificado contra ela. Trocá-la sem cerimônia invalidaria a
 * verificação de tudo que existe — por isso em produção ela é **obrigatória** no
 * ambiente, e só em desenvolvimento se gera uma automaticamente.
 */
@Injectable()
export class ChaveDaPlataformaService implements OnModuleInit {
  private readonly logger = new Logger(ChaveDaPlataformaService.name);
  private assinadorCarregado: AssinadorEd25519 | null = null;

  constructor(private readonly env: EnvService) {}

  async onModuleInit(): Promise<void> {
    this.assinadorCarregado = await this.carregar();
  }

  get assinador(): AssinadorEd25519 {
    if (this.assinadorCarregado === null)
      throw new Error('Chave da plataforma ainda não carregada.');

    return this.assinadorCarregado;
  }

  private async carregar(): Promise<AssinadorEd25519> {
    const doAmbiente = this.env.chavePrivadaEd25519;

    if (doAmbiente !== undefined) {
      return AssinadorEd25519.deChavePrivada(Buffer.from(doAmbiente, 'base64').toString('utf8'));
    }

    const arquivo = resolve(this.env.diretorioDeArmazenamento, 'chaves', 'plataforma-ed25519.pem');

    if (existsSync(arquivo)) {
      return AssinadorEd25519.deChavePrivada(await readFile(arquivo, 'utf8'));
    }

    const { assinador, privadaPem } = AssinadorEd25519.gerar();

    await mkdir(dirname(arquivo), { recursive: true });
    await writeFile(arquivo, privadaPem, { mode: 0o600 });
    this.logger.warn(
      `Chave Ed25519 de desenvolvimento gerada em ${arquivo} (id ${assinador.idDaChave}). ` +
        'Em produção, defina CHAVE_PRIVADA_ED25519.',
    );

    return assinador;
  }
}
