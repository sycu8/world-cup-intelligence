import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerWebMcpTools } from './lib/webMcp';
import './styles.css';

registerWebMcpTools();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
