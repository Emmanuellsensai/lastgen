import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_IDS } from '@/components/layout/navigation';
import type { KycStatus } from '@/types/api';

export type SessionRole = 'owner' | 'bank' | 'guest';

export interface SessionState {
  role: SessionRole;
  accessToken: string | null;
  businessId: string | null;
  demoBusinessId: string | null;
  demoAssetId: string | null;
  demoLoanId: string | null;
  demoQuoteId: string | null;
  email: string | null;
  fullName: string | null;
  authProvider: 'google' | 'apple' | 'email' | null;
  isSignedIn: boolean;
  isAdmin: boolean;
  kycStatus: KycStatus;
  signIn: (role: 'owner' | 'bank') => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  register: (body: { email: string; password: string; fullName: string; phone: string }) => Promise<void>;
  bootstrap: () => Promise<void>;
  setIsAdmin: (v: boolean) => void;
  setRole: (role: SessionRole) => void;
  setAccessToken: (token: string | null) => void;
  setBusinessId: (id: string | null) => void;
  setKycStatus: (status: KycStatus) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      role: 'guest',
      accessToken: null,
      businessId: null,
      demoBusinessId: null,
      demoAssetId: null,
      demoLoanId: null,
      demoQuoteId: null,
      email: null,
      fullName: null,
      authProvider: null,
      isSignedIn: false,
      isAdmin: false,
      kycStatus: 'unverified',

      signIn: (role) =>
        set({
          role,
          isSignedIn: true,
          demoBusinessId: DEMO_IDS.businessId,
          demoAssetId: DEMO_IDS.assetId,
          demoLoanId: DEMO_IDS.loanId,
          demoQuoteId: DEMO_IDS.quoteId,
          isAdmin: role === 'bank',
        }),

      signInWithEmail: async (email, _password) => {
        const { api, API_MODE, setAuthToken } = await import('@/lib/api');

        if (API_MODE === 'live') {
          const result = await api.auth.login({ email, password: _password });
          setAuthToken(result.accessToken);
          set({
            email: result.user.email,
            fullName: result.user.fullName,
            authProvider: 'email',
            isSignedIn: true,
            role: result.role,
            accessToken: result.accessToken,
            businessId: result.businessId,
            isAdmin: result.role === 'bank',
          });
        } else {
          const result = await api.auth.login({ email, password: _password });
          set({
            email: result.user.email,
            fullName: result.user.fullName,
            authProvider: 'email',
            isSignedIn: true,
            role: result.role,
            accessToken: result.accessToken,
            businessId: result.businessId,
            demoBusinessId: DEMO_IDS.businessId,
            demoAssetId: DEMO_IDS.assetId,
            demoLoanId: DEMO_IDS.loanId,
            demoQuoteId: DEMO_IDS.quoteId,
            isAdmin: result.role === 'bank',
          });
        }
      },

      signInWithGoogle: async () => {
        const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');

        if (hasSupabaseConfig && supabase) {
          const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
          if (error) throw error;
        } else {
          get().signIn('owner');
        }
      },

      signInWithApple: async () => {
        const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');

        if (hasSupabaseConfig && supabase) {
          const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple' });
          if (error) throw error;
        } else {
          get().signIn('owner');
        }
      },

      register: async (body) => {
        const { api, API_MODE, setAuthToken } = await import('@/lib/api');

        if (API_MODE === 'live') {
          const result = await api.auth.register(body);
          setAuthToken(result.accessToken);
          set({
            email: result.user.email,
            fullName: result.user.fullName,
            authProvider: 'email',
            isSignedIn: true,
            role: result.role,
            accessToken: result.accessToken,
            businessId: result.businessId,
            isAdmin: result.role === 'bank',
          });
        } else {
          const result = await api.auth.register(body);
          set({
            email: result.user.email,
            fullName: result.user.fullName,
            authProvider: 'email',
            isSignedIn: true,
            role: result.role,
            accessToken: result.accessToken,
            businessId: result.businessId,
            demoBusinessId: DEMO_IDS.businessId,
            demoAssetId: DEMO_IDS.assetId,
            demoLoanId: DEMO_IDS.loanId,
            demoQuoteId: DEMO_IDS.quoteId,
            isAdmin: result.role === 'bank',
          });
        }
      },

      bootstrap: async () => {
        const { API_MODE } = await import("@/lib/api");
        if (API_MODE !== 'live') return;
        const state = useSession.getState();
        if (!state.businessId) return;
        try {
          // Until that endpoint exists, components fetch individually
        } catch { /* ignore */ }
      },

      setKycStatus: (kycStatus) => set({ kycStatus }),
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      setRole: (role) => set({ role }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setBusinessId: (businessId) => set({ businessId }),

      signOut: () =>
        set({
          role: 'guest',
          accessToken: null,
          businessId: null,
          demoBusinessId: null,
          demoAssetId: null,
          demoLoanId: null,
          demoQuoteId: null,
          email: null,
          fullName: null,
          authProvider: null,
          isSignedIn: false,
          isAdmin: false,
          kycStatus: 'unverified',
        }),
    }),
    { name: 'lastgen.session' },
  ),
);
