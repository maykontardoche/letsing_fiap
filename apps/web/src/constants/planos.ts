/**
 * Os planos, como aparecem na landing e em Configurações.
 *
 * ⚠️ O **limite** de envios de cada plano é regra de negócio e vive no servidor
 * (`apps/api/src/common/planos.ts`) — é ele que recusa o envio além da cota.
 * Aqui mora só a apresentação; o número exibido precisa bater com o de lá, e há
 * teste conferindo.
 */
export type IdDoPlano = 'basico' | 'profissional' | 'empresarial';

export interface Plano {
  readonly id: IdDoPlano;
  readonly nome: string;
  readonly publico: string;
  readonly preco: string;
  readonly periodo?: string;
  /** `null` = ilimitado. */
  readonly enviosPorMes: number | null;
  readonly recursos: readonly string[];
  readonly chamada: string;
  readonly destaque: boolean;
}

export const PLANOS: readonly Plano[] = [
  {
    id: 'basico',
    nome: 'Básico',
    publico: 'Para quem está começando',
    preco: 'Grátis',
    enviosPorMes: 10,
    recursos: [
      '10 documentos enviados por mês',
      'Até 3 pessoas na equipe',
      'Verificação por e-mail e biometria',
      'Validação pública por QR Code',
    ],
    chamada: 'Começar grátis',
    destaque: false,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    publico: 'Para escritórios e times',
    preco: 'R$ 89',
    periodo: '/mês',
    enviosPorMes: 100,
    recursos: [
      '100 documentos enviados por mês',
      'Equipe ilimitada, com papéis',
      'Verificação completa: rosto, voz e gestos',
      'Trilha de auditoria exportável',
      'Assinatura em ordem e com prazo',
    ],
    chamada: 'Assinar o Profissional',
    destaque: true,
  },
  {
    id: 'empresarial',
    nome: 'Empresarial',
    publico: 'Para grandes volumes',
    preco: 'R$ 349',
    periodo: '/mês',
    enviosPorMes: null,
    recursos: [
      'Envios ilimitados',
      'Tudo do Profissional',
      'MFA obrigatório para a equipe',
      'Suporte prioritário',
    ],
    chamada: 'Falar com vendas',
    destaque: false,
  },
];

export function planoPorId(id: string): Plano {
  return PLANOS.find((plano) => plano.id === id) ?? (PLANOS[0] as Plano);
}
