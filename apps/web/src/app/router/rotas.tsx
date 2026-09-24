import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/pages/publico/LandingPage';
import { EmConstrucaoPage } from '@/pages/EmConstrucaoPage';
import { CadastroPage } from '@/pages/auth/CadastroPage';
import { EntrarPage } from '@/pages/auth/EntrarPage';
import { EsqueciSenhaPage, MfaPage, RedefinirSenhaPage } from '@/pages/auth/RecuperacaoPages';
import { PainelPage } from '@/pages/app/PainelPage';
import { DocumentosPage } from '@/pages/app/documentos/DocumentosPage';
import { DetalheDoDocumentoPage } from '@/pages/app/documentos/DetalheDoDocumentoPage';
import { NovoDocumentoPage } from '@/pages/app/documentos/NovoDocumentoPage';
import { PrepararDocumentoPage } from '@/pages/app/documentos/PrepararDocumentoPage';
import { FronteiraDeErro } from './FronteiraDeErro';
import { RotaProtegida } from './RotaProtegida';

export const rotas: RouteObject[] = [
  {
    errorElement: <FronteiraDeErro />,
    children: [
      { path: '/', element: <LandingPage /> },
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
              { path: '*', element: <EmConstrucaoPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <EmConstrucaoPage /> },
    ],
  },
];

export const roteador = createBrowserRouter(rotas);
