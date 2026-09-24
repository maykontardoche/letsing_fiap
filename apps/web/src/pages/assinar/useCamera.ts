import { useCallback, useEffect, useRef, useState } from 'react';

type EstadoDaCamera = 'desligada' | 'pedindo' | 'ligada' | 'negada' | 'indisponivel';

/**
 * Liga a câmera frontal num `<video>` e **desliga ao desmontar** — câmera que
 * continua acesa depois da verificação é o tipo de coisa que faz a pessoa
 * desconfiar, com razão, de tudo o mais.
 */
export function useCamera() {
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const [estado, definirEstado] = useState<EstadoDaCamera>('desligada');

  const desligar = useCallback(() => {
    fluxo.current?.getTracks().forEach((trilha) => trilha.stop());
    fluxo.current = null;
    if (video.current) video.current.srcObject = null;
    definirEstado('desligada');
  }, []);

  const ligar = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      definirEstado('indisponivel');
      return false;
    }

    definirEstado('pedindo');

    try {
      const novo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      fluxo.current = novo;

      if (video.current) {
        video.current.srcObject = novo;
        await video.current.play();
      }

      definirEstado('ligada');
      return true;
    } catch (erro) {
      definirEstado(
        erro instanceof DOMException && erro.name === 'NotAllowedError' ? 'negada' : 'indisponivel',
      );
      return false;
    }
  }, []);

  useEffect(() => desligar, [desligar]);

  return { video, estado, ligar, desligar };
}

export const MENSAGEM_DA_CAMERA: Record<'negada' | 'indisponivel', string> = {
  negada:
    'O acesso à câmera foi negado. Clique no ícone de cadeado da barra de endereço, permita a câmera e tente de novo.',
  indisponivel:
    'Não encontramos uma câmera disponível. Verifique se outro aplicativo está usando a câmera.',
};
