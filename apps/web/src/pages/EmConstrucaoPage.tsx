import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { Logo } from '@/components/marca/Logo';
import { estilosDeBotao } from '@/components/ui/Botao';

/** Placeholder temporário enquanto a tela é construída. */
export function EmConstrucaoPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <span className="bg-destaque-suave text-destaque flex size-14 items-center justify-center rounded-2xl">
        <Hammer className="size-7" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-tinta text-2xl font-bold">Esta tela está sendo construída</h1>
        <p className="text-tinta-2 mt-2">Volte em alguns minutos — ela aparece aqui automaticamente.</p>
      </div>
      <Link to="/" className={estilosDeBotao('secundario')}>
        Voltar ao início
      </Link>
    </div>
  );
}
