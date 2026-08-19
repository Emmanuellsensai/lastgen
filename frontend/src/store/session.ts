import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SessionRole = 'owner' | 'bank' | 'guest';

export interface SessionState {
  role: SessionRole;
  accessToken: string | null;
  /** Business the owner views are pointed at. */
  businessId: string | null;
  setRole: (role: SessionRole) => void;
  setAccessToken: (token: string | null) => void;
  setBusinessId: (id: string | null) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      role: 'guest',
      accessToken: null,
      businessId: null,
      setRole: (role) => set({ role }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setBusinessId: (businessId) => set({ businessId }),
      signOut: () => set({ role: 'guest', accessToken: null, businessId: null }),
    }),
    { name: 'lastgen.session' },
  ),
);
