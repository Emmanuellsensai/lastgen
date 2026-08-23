import {
  Bank,
  DotsThreeCircle,
  Flame,
  Gauge,
  House,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  SquaresFour,
  Sun,
  Trophy,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { DEMO_BUSINESS_ID } from '@/mocks/seed';

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  /** Treat sub paths as active too, so /bank/file/:id keeps Bank lit. */
  matchPrefix?: string;
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

/**
 * The five mobile tabs. Every authenticated route lights exactly one of them,
 * which is what keeps a user oriented on an inner screen.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/burn', label: 'Burn', icon: Flame, matchPrefix: '/burn' },
  { to: `/asset/${DEMO_IDS.assetId}`, label: 'Systems', icon: Sun, matchPrefix: '/asset' },
  { to: '/bank', label: 'Bank', icon: Bank, matchPrefix: '/bank' },
  { to: '/demo', label: 'More', icon: DotsThreeCircle, matchPrefix: '/demo' },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Your business',
    items: [
      { to: '/burn', label: 'Burn', icon: Flame, matchPrefix: '/burn' },
      { to: `/quote/${DEMO_IDS.quoteId}`, label: 'Quote', icon: Receipt, matchPrefix: '/quote' },
      {
        to: `/asset/${DEMO_IDS.assetId}`,
        label: 'Your systems',
        icon: Sun,
        matchPrefix: '/asset',
      },
      {
        to: `/wrapped/${DEMO_IDS.businessId}`,
        label: 'Wrapped',
        icon: Trophy,
        matchPrefix: '/wrapped',
      },
    ],
  },
  {
    heading: 'Bank',
    items: [
      { to: '/bank', label: 'Applications', icon: Bank },
      { to: '/bank/portfolio', label: 'Portfolio', icon: SquaresFour },
    ],
  },
  {
    heading: 'Demo',
    items: [{ to: '/demo', label: 'Control', icon: SlidersHorizontal, matchPrefix: '/demo' }],
  },
];

/* ------------------------------------------------------------------ */
/* Role-specific nav                                                   */
/* ------------------------------------------------------------------ */

export const OWNER_PRIMARY_NAV: NavItem[] = [
  { to: '/app', label: 'Home', icon: House },
  { to: '/burn', label: 'Burn', icon: Flame, matchPrefix: '/burn' },
  { to: `/asset/${DEMO_IDS.assetId}`, label: 'Systems', icon: Sun, matchPrefix: '/asset' },
  { to: '/kyc', label: 'Verify', icon: ShieldCheck, matchPrefix: '/kyc' },
  { to: '/demo', label: 'More', icon: DotsThreeCircle, matchPrefix: '/demo' },
];

export const BANK_PRIMARY_NAV: NavItem[] = [
  { to: '/admin', label: 'Admin', icon: Gauge, matchPrefix: '/admin' },
  { to: '/bank', label: 'Applications', icon: Bank, matchPrefix: '/bank' },
  { to: '/bank/portfolio', label: 'Portfolio', icon: SquaresFour },
  { to: '/demo', label: 'More', icon: DotsThreeCircle, matchPrefix: '/demo' },
];

export const OWNER_NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Your business',
    items: [
      { to: '/app', label: 'Dashboard', icon: House },
      { to: '/burn', label: 'Burn', icon: Flame, matchPrefix: '/burn' },
      { to: `/quote/${DEMO_IDS.quoteId}`, label: 'Quote', icon: Receipt, matchPrefix: '/quote' },
      {
        to: `/asset/${DEMO_IDS.assetId}`,
        label: 'Your systems',
        icon: Sun,
        matchPrefix: '/asset',
      },
      {
        to: `/wrapped/${DEMO_IDS.businessId}`,
        label: 'Wrapped',
        icon: Trophy,
        matchPrefix: '/wrapped',
      },
      {
        to: '/kyc',
        label: 'Identity check',
        icon: ShieldCheck,
        matchPrefix: '/kyc',
      },
    ],
  },
];

export const BANK_NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Admin',
    items: [
      { to: '/admin', label: 'Dashboard', icon: Gauge, matchPrefix: '/admin' },
    ],
  },
  {
    heading: 'Credit desk',
    items: [
      { to: '/bank', label: 'Applications', icon: Bank },
      { to: '/bank/portfolio', label: 'Portfolio', icon: SquaresFour },
    ],
  },
  {
    heading: 'Demo',
    items: [{ to: '/demo', label: 'Control', icon: SlidersHorizontal, matchPrefix: '/demo' }],
  },
];
