import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import './styles/globals.css';
import App from './App';

async function startMocks() {
  if (import.meta.env.VITE_API_MODE !== 'mock') return;
  try {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  } catch (error) {
    // Some embedded browsers refuse to register a service worker. Render the
    // app anyway: the shells are static, and data calls surface their own
    // error state rather than leaving a blank page behind.
    console.warn('Mock service worker did not start, continuing without it.', error);
  }
}

async function bootstrap() {
  await startMocks();

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
