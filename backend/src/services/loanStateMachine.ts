import { ApiError } from '../middleware/errorHandler.js';
import type { Loan, LoanStatus } from '../types/api.js';

// Loan state machine.
//
// Loan status is intentionally a separate, simpler machine from the asset
// machine (frozen in docs/CONTRACT.md):
//
//   ACTIVE -> DELINQUENT -> ACTIVE | CLOSED
//
// Each helper returns a shallow copy so callers keep their original reference
// untouched until they decide to persist the result.

export function markDelinquent(loan: Loan): Loan {
  assertNotClosed(loan, 'become delinquent');
  return { ...loan, status: 'DELINQUENT' };
}

export function recover(loan: Loan): Loan {
  assertNotClosed(loan, 'be reactivated');
  return { ...loan, status: 'ACTIVE' };
}

export function close(loan: Loan): Loan {
  return { ...loan, status: 'CLOSED' };
}

function assertNotClosed(loan: Loan, what: string): void {
  if (loan.status === 'CLOSED') {
    throw new ApiError('INVALID_TRANSITION', `A closed loan cannot ${what}`, 409);
  }
}

export type { Loan, LoanStatus };
