import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { Monograma } from '@/components/marca/Logo';
import { LandingPage } from '@/pages/publico/LandingPage';
import { FronteiraDeErro } from './FronteiraDeErro';
import { RotaProtegida } from './RotaProtegida';

/**
 * Cada tela vira um chunk carregado sob demanda. A landing fica no bundle
 * principal (é a primeira impressão); o resto só baixa quando alguém navega até
 * ele — quem vai só validar um documento não carrega o painel nem os gráficos.
 */
function sobDemanda<T, K extends keyof T>(carregar: () => Promise<T>, nome: K) {
  const Componente = lazy(() =>
    carregar().then((modulo) => ({ default: modulo[nome] as unknown as ComponentType })),
  );

  return function Carregado(): ReactNode {
    return (
      <Suspense
        fallback={
          <div role="status" className="flex min-h-[50vh] items-center justify-center">
            <Monograma className="animate-pulso-suave size-10" />
            <span className="sr-only">Carregando…</span>
          </div>
        }
      >
        <Componente />
      </Suspense>
    );
  };
}

const EntrarPage = sobDemanda(() => import('@/pages/auth/EntrarPage'), 'EntrarPage');
const CadastroPage = sobDemanda(() => import('@/pages/auth/CadastroPage'), 'CadastroPage');
const EsqueciSenhaPage = sobDemanda(
  () => import('@/pages/auth/RecuperacaoPages'),
  'EsqueciSenhaPage',
);
const RedefinirSenhaPage = sobDemanda(
  () => import('@/pages/auth/RecuperacaoPages'),
  'RedefinirSenhaPage',
);
const MfaPage = sobDemanda(() => import('@/pages/auth/RecuperacaoPages'), 'MfaPage');
const ValidarPage = sobDemanda(() => import('@/pages/publico/ValidarPage'), 'ValidarPage');
const AssinarPage = sobDemanda(() => import('@/pages/assinar/AssinarPage'), 'AssinarPage');
const AppShell = sobDemanda(() => import('@/components/layout/AppShell'), 'AppShell');
const PainelPage = sobDemanda(() => import('@/pages/app/PainelPage'), 'PainelPage');
const DocumentosPage = sobDemanda(
  () => import('@/pages/app/documentos/DocumentosPage'),
  'DocumentosPage',
);
const NovoDocumentoPage = sobDemanda(
  () => import('@/pages/app/documentos/NovoDocumentoPage'),
  'NovoDocumentoPage',
);
const DetalheDoDocumentoPage = sobDemanda(
  () => import('@/pages/app/documentos/DetalheDoDocumentoPage'),
  'DetalheDoDocumentoPage',
);
const PrepararDocumentoPage = sobDemanda(
  () => import('@/pages/app/documentos/PrepararDocumentoPage'),
  'PrepararDocumentoPage',
);
const EquipePage = sobDemanda(() => import('@/pages/app/EquipePage'), 'EquipePage');
const AuditoriaPage = sobDemanda(() => import('@/pages/app/AuditoriaPage'), 'AuditoriaPage');
const ConfiguracoesPage = sobDemanda(
  () => import('@/pages/app/ConfiguracoesPage'),
  'ConfiguracoesPage',
);
const NaoEncontradaPage = sobDemanda(
  () => import('@/pages/NaoEncontradaPage'),
  'NaoEncontradaPage',
);

export const rotas: RouteObject[] = [
  {
    errorElement: <FronteiraDeErro />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/validar', element: <ValidarPage /> },
      { path: '/validar/:codigo', element: <ValidarPage /> },
      // Público: quem assina não tem conta — o token do link é a credencial.
      { path: '/assinar/:token', element: <AssinarPage /> },
      { path: '/entrar', element: <EntrarPage /> },
      { path: '/cadastro', element: <CadastroPage /> },
      { path: '/esqueci-senha', element: <EsqueciSenhaPage /> },
      { path: '/redefinir-senha', element: <RedefinirSenhaPage /> },
      // ⚠️ Fora da RotaProtegida: ela redirecionaria "falta o MFA" para cá, num laço.
      { path: '/mfa', element: <MfaPage /> },
      {
        element: <RotaProtegida />,
        children: [
          {
            path: '/app',
            element: <AppShell />,
            children: [
              { index: true, element: <PainelPage /> },
              { path: 'documentos', element: <DocumentosPage /> },
              // ⚠️ A rota literal antes de `:uuid`, que engoliria "novo".
              { path: 'documentos/novo', element: <NovoDocumentoPage /> },
              { path: 'documentos/:uuid', element: <DetalheDoDocumentoPage /> },
              { path: 'documentos/:uuid/preparar', element: <PrepararDocumentoPage /> },
              { path: 'equipe', element: <EquipePage /> },
              { path: 'auditoria', element: <AuditoriaPage /> },
              { path: 'configuracoes', element: <ConfiguracoesPage /> },
              { path: '*', element: <NaoEncontradaPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
];

export const roteador = createBrowserRouter(rotas);
