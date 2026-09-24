import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compõe classes do Tailwind resolvendo conflitos (`px-2` + `px-4` → `px-4`).
 * É o que permite um componente aceitar `className` sem que o chamador precise
 * brigar com a especificidade do estilo base.
 */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
