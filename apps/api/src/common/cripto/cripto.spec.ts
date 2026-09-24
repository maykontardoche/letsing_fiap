import { AssinadorEd25519 } from './assinador-ed25519';
import { jsonCanonico } from './canonico';
import { chaveDeCifra, cifrar, decifrar } from './cifra';
import {
  ehSha256,
  gerarCodigoDeDocumento,
  gerarToken,
  iguaisEmTempoConstante,
  sha256,
} from './hash';
import { conferirSenha, gerarHashDeSenha, problemasDaSenha } from './senha';

describe('JSON canônico', () => {
  it('ordena as chaves em qualquer profundidade — a ordem de montagem não muda os bytes', () => {
    const a = jsonCanonico({ b: 1, a: { z: true, y: [3, { d: 1, c: 2 }] } });
    const b = jsonCanonico({ a: { y: [3, { c: 2, d: 1 }], z: true }, b: 1 });

    expect(a).toBe(b);
    expect(a).toBe('{"a":{"y":[3,{"c":2,"d":1}],"z":true},"b":1}');
  });

  it('serializa Date em ISO-8601 e omite undefined, como o JSON', () => {
    expect(
      jsonCanonico({ em: new Date('2026-01-02T03:04:05.006Z'), nada: undefined, nulo: null }),
    ).toBe('{"em":"2026-01-02T03:04:05.006Z","nulo":null}');
  });
});

describe('Assinatura Ed25519 da plataforma', () => {
  const { assinador, privadaPem } = AssinadorEd25519.gerar();

  it('assina e verifica a carga canônica', () => {
    const { carga, assinatura } = assinador.assinar({
      documento: 'x',
      hashOriginal: 'a'.repeat(64),
    });

    expect(assinador.verificar(carga, assinatura)).toBe(true);
  });

  it('um único caractere alterado na carga invalida a assinatura', () => {
    const { carga, assinatura } = assinador.assinar({ nome: 'Mariana', valor: 100 });

    expect(assinador.verificar(carga.replace('100', '101'), assinatura)).toBe(false);
  });

  it('assinatura malformada é "inválida", nunca exceção', () => {
    const { carga } = assinador.assinar({ a: 1 });

    expect(assinador.verificar(carga, 'isto-nao-e-base64-de-64-bytes')).toBe(false);
    expect(assinador.verificar(carga, '')).toBe(false);
  });

  it('recarregar a mesma chave privada preserva a identidade (id e verificação)', () => {
    const recarregado = AssinadorEd25519.deChavePrivada(privadaPem);
    const { carga, assinatura } = assinador.assinar({ a: 1 });

    expect(recarregado.idDaChave).toBe(assinador.idDaChave);
    expect(recarregado.verificar(carga, assinatura)).toBe(true);
  });

  it('outra chave não verifica o que esta assinou', () => {
    const outro = AssinadorEd25519.gerar().assinador;
    const { carga, assinatura } = assinador.assinar({ a: 1 });

    expect(outro.verificar(carga, assinatura)).toBe(false);
  });
});

describe('Cifra de campo (AES-256-GCM)', () => {
  const chave = chaveDeCifra('b'.repeat(64));

  it('cifra e decifra; o mesmo texto gera cifrados diferentes (IV aleatório)', () => {
    const a = cifrar('529.982.247-25', chave);
    const b = cifrar('529.982.247-25', chave);

    expect(a).not.toBe(b);
    expect(decifrar(a, chave)).toBe('529.982.247-25');
  });

  it('adulterar o cifrado faz a decifragem falhar, em vez de devolver lixo', () => {
    const [iv, tag, dados] = cifrar('segredo', chave).split(':') as [string, string, string];
    const adulterado = `${iv}:${tag}:${dados.replace(/.$/, dados.endsWith('0') ? '1' : '0')}`;

    expect(() => decifrar(adulterado, chave)).toThrow();
  });

  it('chave errada não decifra', () => {
    expect(() => decifrar(cifrar('segredo', chave), chaveDeCifra('c'.repeat(64)))).toThrow();
  });

  it('recusa chave com tamanho diferente de 32 bytes', () => {
    expect(() => chaveDeCifra('ab')).toThrow(/32 bytes/);
  });
});

describe('Senha (scrypt)', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await gerarHashDeSenha('Senha@Forte2026');

    expect(hash.startsWith('scrypt$65536$8$1$')).toBe(true);
    await expect(conferirSenha('Senha@Forte2026', hash)).resolves.toBe(true);
    await expect(conferirSenha('senha@forte2026', hash)).resolves.toBe(false);
  });

  it('hash malformado é "não confere", não exceção', async () => {
    await expect(conferirSenha('x', 'bcrypt$lixo')).resolves.toBe(false);
  });

  it('a política lista exatamente o que falta', () => {
    expect(problemasDaSenha('Senha@Forte2026')).toEqual([]);
    expect(problemasDaSenha('abc')).toEqual([
      'ter pelo menos 10 caracteres',
      'ter uma letra maiúscula',
      'ter um número',
      'ter um símbolo',
    ]);
  });
});

describe('Hashes e tokens', () => {
  it('SHA-256 conhecido', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(ehSha256(sha256('x'))).toBe(true);
    expect(ehSha256('XYZ')).toBe(false);
  });

  it('o token vai para a URL e só o hash para o banco', () => {
    const { token, hash } = gerarToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(sha256(token));
  });

  it('código do documento no formato LS-XXXX-XXXX, sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i += 1)
      expect(gerarCodigoDeDocumento()).toMatch(/^LS-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  });

  it('comparação em tempo constante', () => {
    expect(iguaisEmTempoConstante('abc', 'abc')).toBe(true);
    expect(iguaisEmTempoConstante('abc', 'abd')).toBe(false);
    expect(iguaisEmTempoConstante('abc', 'abcd')).toBe(false);
  });
});
