import {
  Building2,
  Flame,
  LayoutGrid,
  Receipt,
  SlidersHorizontal,
  Sun,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DEMO_BUSINESS_ID } from '@/mocks/seed';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile tab bar. The rest live in the desktop rail only. */
  primary?: boolean;
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

/** Demo deep links. Real ids arrive from the API once a session is signed in. */
export const DEMO_IDS = {
  businessId: DEMO_BUSINESS_ID,
  quoteId: `q_${DEMO_BUSINESS_ID}`,
  assetId: `ast_${DEMO_BUSINESS_ID}`,
  loanId: `loan_${DEMO_BUSINESS_ID}`,
  creditFileId: `cf_${DEMO_BUSINESS_ID}`,
};

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Business',
    items: [
      { to: '/burn', label: 'Burn', icon: Flame, primary: true },
      { to: `/quote/${DEMO_IDS.quoteId}`, label: 'Quote', icon: Receipt, primary: true },
      { to: `/asset/${DEMO_IDS.assetId}`, label: 'Asset', icon: Sun, primary: true },
      { to: `/wrapped/${DEMO_IDS.businessId}`, label: 'Wrapped', icon: Trophy },
    ],
  },
  {
    heading: 'Bank',
    items: [
      { to: '/bank', label: 'Applications', icon: Building2, primary: true },
      { to: '/bank/portfolio', label: 'Portfolio', icon: LayoutGrid },
    ],
  },
  {
    heading: 'Demo',
    items: [{ to: '/demo', label: 'Control', icon: SlidersHorizontal }],
  },
];

export const PRIMARY_NAV: NavItem[] = NAV_GROUPS.flatMap((group) =>
  group.items.filter((item) => item.primary),
);
