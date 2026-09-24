import type { LucideProps } from 'lucide-react';

/** "V" de paz — o lucide não tem; desenhado no mesmo estilo de traço (24×24, traço 2). */
export function MaoEmV({ size = 24, className }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path d="M9 11 7 3.5a1.5 1.5 0 0 1 2.9-.8L12 10" />
      <path d="M12 10l1.8-7.2a1.5 1.5 0 0 1 2.9.8L15 11" />
      <path d="M15 11.5V12a1.5 1.5 0 0 1 3 0v2a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 14.5v-1a2 2 0 0 1 2-2h6.5a1.5 1.5 0 0 1 0 3H10" />
    </svg>
  );
}
