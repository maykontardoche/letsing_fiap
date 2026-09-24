import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { LandingPage } from '@/pages/publico/LandingPage';
import { EmConstrucaoPage } from '@/pages/EmConstrucaoPage';
import { FronteiraDeErro } from './FronteiraDeErro';

export const rotas: RouteObject[] = [
  {
    errorElement: <FronteiraDeErro />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '*', element: <EmConstrucaoPage /> },
    ],
  },
];

export const roteador = createBrowserRouter(rotas);
