import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { MetaProvider } from './lib/meta';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The app root element is missing.');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <MetaProvider>
          <App />
        </MetaProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      // A quiet console note. The UI explains saved-snapshot behaviour on the install page.
      console.info('[uniscope] App shell cached for offline opening.');
    },
  });
}
