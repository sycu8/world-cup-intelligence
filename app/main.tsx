import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startHomePrefetch } from './lib/homePrefetch';
import './styles.css';

startHomePrefetch();

const scheduleWebMcp = () => {
  void import('./lib/webMcp').then(({ registerWebMcpTools }) => registerWebMcpTools());
};
if (typeof window.requestIdleCallback === 'function') {
  window.requestIdleCallback(scheduleWebMcp, { timeout: 4000 });
} else {
  globalThis.setTimeout(scheduleWebMcp, 2000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
