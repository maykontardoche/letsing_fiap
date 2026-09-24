import type { LucideIcon, LucideProps } from 'lucide-react';
import { Hand, HandFist, Pointer, ThumbsUp } from 'lucide-react';
import type { Gesto } from '@/lib/api/assinatura';

/** "V" de paz — o lucide não tem; desenhado no mesmo estilo de traço. */
function MaoEmV(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={props.size ?? 24}
      height={props.size ?? 24}
      className={props.className}
      aria-hidden="true"
    >
      <path d="M9 11 7 3.5a1.5 1.5 0 0 1 2.9-.8L12 10" />
      <path d="M12 10l1.8-7.2a1.5 1.5 0 0 1 2.9.8L15 11" />
      <path d="M15 11.5V12a1.5 1.5 0 0 1 3 0v2a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 14.5v-1a2 2 0 0 1 2-2h6.5a1.5 1.5 0 0 1 0 3H10" />
    </svg>
  );
}

export const GESTOS: Record<Gesto, { rotulo: string; dica: string; icone: LucideIcon | typeof MaoEmV }> = {
  Open_Palm: { rotulo: 'Mão aberta', dica: 'Palma voltada para a câmera, dedos separados', icone: Hand },
  Closed_Fist: { rotulo: 'Punho fechado', dica: 'Feche a mão, como se segurasse algo', icone: HandFist },
  Pointing_Up: { rotulo: 'Dedo apontando para cima', dica: 'Só o indicador levantado', icone: Pointer },
  Thumb_Up: { rotulo: 'Joinha', dica: 'Polegar para cima, outros dedos fechados', icone: ThumbsUp },
  Victory: { rotulo: 'Sinal de "V"', dica: 'Indicador e médio levantados, em V', icone: MaoEmV },
};
