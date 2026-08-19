import { create } from 'zustand';

export interface DemoState {
  /** Days the demo clock has been pushed forward from the seed anchor. */
  daysAdvanced: number;
  /** Set while a demo control request is in flight. */
  busy: boolean;
  lastAction: string | null;
  setBusy: (busy: boolean) => void;
  recordAdvance: (days: number) => void;
  recordAction: (label: string) => void;
  reset: () => void;
}

export const useDemo = create<DemoState>((set) => ({
  daysAdvanced: 0,
  busy: false,
  lastAction: null,
  setBusy: (busy) => set({ busy }),
  recordAdvance: (days) =>
    set((state) => ({
      daysAdvanced: state.daysAdvanced + days,
      lastAction: `Advanced the clock by ${days} days`,
    })),
  recordAction: (label) => set({ lastAction: label }),
  reset: () => set({ daysAdvanced: 0, busy: false, lastAction: 'Demo data reset' }),
}));
