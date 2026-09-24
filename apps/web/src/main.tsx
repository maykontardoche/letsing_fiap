import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Provedores } from '@/app/providers/Provedores';
import { roteador } from '@/app/router/rotas';
import '@/styles/index.css';

const raiz = document.getElementById('root');

if (raiz === null) throw new Error('Elemento #root não encontrado no index.html.');

createRoot(raiz).render(
  <StrictMode>
    <Provedores>
      <RouterProvider router={roteador} />
    </Provedores>
  </StrictMode>,
);
