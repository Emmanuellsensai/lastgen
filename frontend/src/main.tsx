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

/**
 * Bridge the Supabase auth session to the API client's bearer token.
 * This must run on every app startup and listen for session changes so that:
 *   1. A page refresh preserves the auth token (Supabase persists the session
 *      in localStorage; we read it once on boot).
 *   2. Google / Apple OAuth redirects land with a fresh session that needs to
 *      be forwarded to the API client.
 *   3. Token refreshes (Supabase auto-refresh) keep the API client current.
 */
async function initAuth() {
  try {
    const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');
    if (!hasSupabaseConfig || !supabase) return;

    const { setAuthToken } = await import('@/lib/api');

    // 1. Seed the token from the current session (handles page refresh).
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      setAuthToken(session.access_token);
    }

    // 2. Listen for future sign-in / sign-out / token-refresh events.
    supabase.auth.onAuthStateChange((_event, newSession) => {
      setAuthToken(newSession?.access_token ?? null);
    });
  } catch {
    // Non-critical: if Supabase isn't configured the app runs in mock mode.
  }
}

async function bootstrap() {
  await startMocks();
  // Bridge Supabase session → API bearer token before any component renders.
  await initAuth();

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
