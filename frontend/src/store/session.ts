import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_IDS } from '@/components/layout/navigation';

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
  signIn: (role: 'owner' | 'bank') => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  register: (body: { email: string; password: string; fullName: string; phone: string }) => Promise<void>;
  setIsAdmin: (v: boolean) => void;
  setRole: (role: SessionRole) => void;
  setAccessToken: (token: string | null) => void;
  setBusinessId: (id: string | null) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
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
        // In mock mode, import dynamically to avoid circular deps
        const { api } = await import('@/lib/api');
        const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');

        if (hasSupabaseConfig && supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password: _password });
          if (error) throw error;
          const { setAuthToken } = await import('@/lib/api');
          setAuthToken(data.session?.access_token ?? null);
          set({
            email,
            authProvider: 'email',
            isSignedIn: true,
            role: 'owner',
            accessToken: data.session?.access_token ?? null,
            demoBusinessId: DEMO_IDS.businessId,
            demoAssetId: DEMO_IDS.assetId,
            demoLoanId: DEMO_IDS.loanId,
            demoQuoteId: DEMO_IDS.quoteId,
          });
        } else {
          // Mock mode: call mock endpoint
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
          // Mock mode: demo shortcut
          get().signIn('owner');
        }
      },

      signInWithApple: async () => {
        const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');

        if (hasSupabaseConfig && supabase) {
          const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple' });
          if (error) throw error;
        } else {
          // Mock mode: demo shortcut
          get().signIn('owner');
        }
      },

      register: async (body) => {
        const { api } = await import('@/lib/api');
        const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');

        if (hasSupabaseConfig && supabase) {
          const { data, error } = await supabase.auth.signUp({
            email: body.email,
            password: body.password,
            options: { data: { fullName: body.fullName, phone: body.phone } },
          });
          if (error) throw error;
          const { setAuthToken } = await import('@/lib/api');
          setAuthToken(data.session?.access_token ?? null);
          set({
            email: body.email,
            fullName: body.fullName,
            authProvider: 'email',
            isSignedIn: true,
            role: 'owner',
            accessToken: data.session?.access_token ?? null,
            demoBusinessId: DEMO_IDS.businessId,
            demoAssetId: DEMO_IDS.assetId,
            demoLoanId: DEMO_IDS.loanId,
            demoQuoteId: DEMO_IDS.quoteId,
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
        }),
    }),
    { name: 'lastgen.session' },
  ),
);
