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
  isAdmin: boolean;
  signIn: (role: 'owner' | 'bank') => void;
  setRole: (role: SessionRole) => void;
  setAccessToken: (token: string | null) => void;
  setBusinessId: (id: string | null) => void;
  register: (body: { email: string; password: string; fullName: string; phone: string }) => Promise<void>;
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
      isAdmin: false,

      signIn: (role) =>
        set({
          role,
          isAdmin: role === 'bank',
          demoBusinessId: DEMO_IDS.businessId,
          demoAssetId: DEMO_IDS.assetId,
          demoLoanId: DEMO_IDS.loanId,
          demoQuoteId: DEMO_IDS.quoteId,
        }),

      setRole: (role) => set({ role }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setBusinessId: (businessId) => set({ businessId }),

      register: async (_body) => {
        // In mock/demo mode, registration just signs in as owner
        set({
          role: 'owner',
          isAdmin: false,
          demoBusinessId: DEMO_IDS.businessId,
          demoAssetId: DEMO_IDS.assetId,
          demoLoanId: DEMO_IDS.loanId,
          demoQuoteId: DEMO_IDS.quoteId,
        });
      },

      signOut: () =>
        set({
          role: 'guest',
          accessToken: null,
          businessId: null,
          demoBusinessId: null,
          demoAssetId: null,
          demoLoanId: null,
          demoQuoteId: null,
          isAdmin: false,
        }),
    }),
    { name: 'lastgen.session' },
  ),
);
