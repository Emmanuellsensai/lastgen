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
  signIn: (role: 'owner' | 'bank') => void;
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

      signIn: (role) =>
        set({
          role,
          demoBusinessId: DEMO_IDS.businessId,
          demoAssetId: DEMO_IDS.assetId,
          demoLoanId: DEMO_IDS.loanId,
          demoQuoteId: DEMO_IDS.quoteId,
        }),

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
        }),
    }),
    { name: 'lastgen.session' },
  ),
);
