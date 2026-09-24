import type { LucideIcon } from 'lucide-react';
import { Hand, HandFist, Pointer, ThumbsUp } from 'lucide-react';
import { MaoEmV } from '@/components/icones/MaoEmV';
import type { Gesto } from '@/lib/api/assinatura';

/** Rótulo, dica e ícone de cada gesto que o servidor pode sortear. */
export const GESTOS: Record<
  Gesto,
  { rotulo: string; dica: string; icone: LucideIcon | typeof MaoEmV }
> = {
  Open_Palm: {
    rotulo: 'Mão aberta',
    dica: 'Palma voltada para a câmera, dedos separados',
    icone: Hand,
  },
  Closed_Fist: {
    rotulo: 'Punho fechado',
    dica: 'Feche a mão, como se segurasse algo',
    icone: HandFist,
  },
  Pointing_Up: {
    rotulo: 'Dedo apontando para cima',
    dica: 'Só o indicador levantado',
    icone: Pointer,
  },
  Thumb_Up: { rotulo: 'Joinha', dica: 'Polegar para cima, outros dedos fechados', icone: ThumbsUp },
  Victory: { rotulo: 'Sinal de "V"', dica: 'Indicador e médio levantados, em V', icone: MaoEmV },
};
