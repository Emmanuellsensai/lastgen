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
    console.warn('Mock service worker did not start, continuing without it.', error);
  }
}

/**
 * Bridge the auth session to the API client's bearer token.
 *
 * Two sources of truth exist:
 * 1. The Zustand session store (`lastgen.session` in localStorage) — populated
 *    by signInWithEmail / register which call setAuthToken() at login time, but
 *    the module-level `authToken` in api.ts resets on page reload.
 * 2. The Supabase browser client — populated by Google / Apple OAuth, which
 *    never calls setAuthToken() at all.
 *
 * We read BOTH on boot so every login path works after a page refresh.
 */
async function initAuth() {
  try {
    const { setAuthToken } = await import('@/lib/api');

    // 1. Restore the token from the persisted Zustand session store.
    //    signInWithEmail / register store `accessToken` here on login.
    try {
      const raw = localStorage.getItem('lastgen.session');
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
        const token = parsed?.state?.accessToken;
        if (token) {
          setAuthToken(token);
        }
      }
    } catch { /* corrupt storage — ignore */ }

    // 2. Also listen for the Supabase session (covers Google / Apple OAuth).
    const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');
    if (hasSupabaseConfig && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAuthToken(session.access_token);
      }
      supabase.auth.onAuthStateChange((_event, newSession) => {
        setAuthToken(newSession?.access_token ?? null);
      });
    }
  } catch {
    // Non-critical: if Supabase isn't configured the app runs in mock mode.
  }
}

async function bootstrap() {
  await startMocks();
  // Bridge session → API bearer token BEFORE any component renders.
  await initAuth();

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
