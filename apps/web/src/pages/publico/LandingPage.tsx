import { NavegacaoPublica } from '@/components/layout/NavegacaoPublica';
import { Hero } from './landing/Hero';
import { Biometria, ComoFunciona, FaixaDeNormas, Seguranca, ValidacaoPublica } from './landing/Secoes';
import { Planos } from './landing/Planos';
import { ChamadaFinal, Perguntas, Rodape } from './landing/Final';

/** A página de entrada pública — a vitrine do produto. */
export function LandingPage() {
  return (
    <>
      <a
        href="#conteudo"
        className="bg-superficie text-tinta sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <NavegacaoPublica />
      <main id="conteudo">
        <Hero />
        <FaixaDeNormas />
        <ComoFunciona />
        <Biometria />
        <Seguranca />
        <ValidacaoPublica />
        <Planos />
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Rodape />
    </>
  );
}
