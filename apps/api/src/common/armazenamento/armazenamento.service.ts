import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';

/**
 * Disco **privado** dos PDFs.
 *
 * ⚠️ Não há URL pública para nada daqui, e não há como criar uma: a única leitura
 * é por rota autenticada, que confere a organização e a posse do documento antes
 * de abrir o arquivo.
 *
 * Convenção de chave: `org-{organizacaoId}/documentos/{uuid}/{original|assinado}.pdf`.
 * O prefixo da organização é a segunda camada contra IDOR — mesmo que um bug
 * entregasse a chave errada, ela não sairia da pasta da organização certa.
 */
@Injectable()
export class ArmazenamentoService {
  private readonly raiz: string;

  constructor(env: EnvService) {
    this.raiz = resolve(env.diretorioDeArmazenamento);
  }

  static chaveDoDocumento(
    organizacaoId: number,
    uuid: string,
    versao: 'original' | 'assinado',
  ): string {
    return `org-${organizacaoId}/documentos/${uuid}/${versao}.pdf`;
  }

  async gravar(chave: string, conteudo: Buffer | Uint8Array): Promise<void> {
    const caminho = this.caminhoSeguro(chave);

    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, conteudo);
  }

  async ler(chave: string): Promise<Buffer> {
    return readFile(this.caminhoSeguro(chave));
  }

  async remover(chave: string): Promise<void> {
    await rm(this.caminhoSeguro(chave), { force: true });
  }

  /** Confere que a organização é dona da chave — a checagem de prefixo. */
  pertence(chave: string, organizacaoId: number): boolean {
    return chave.startsWith(`org-${organizacaoId}/`);
  }

  /**
   * ⚠️ Proteção contra *path traversal*: `../../etc/passwd` resolveria para fora
   * da raiz. Toda chave é resolvida e conferida contra o diretório base.
   */
  private caminhoSeguro(chave: string): string {
    const caminho = resolve(this.raiz, chave);

    if (!caminho.startsWith(this.raiz + sep)) {
      throw new Error('Chave de armazenamento fora do diretório permitido.');
    }

    return caminho;
  }
}
