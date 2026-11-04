import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import bank from 'virtual:bank';
import { App } from './App';
import { browserStorage } from './core/storage.ts';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('No se encontró el elemento raíz');
}

createRoot(root).render(
  <StrictMode>
    <App bank={bank} storage={browserStorage()} />
  </StrictMode>,
);
