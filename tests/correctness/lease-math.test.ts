import { describe, expect, it } from 'vitest';
import { monthlyPaymentKobo } from '../../backend/src/services/leaseEngine.js';

// Correctness suite: lease-math
//
// Phase 0 smoke test: prove vitest resolves backend modules imported through
// the NodeNext `.js` extension convention. The full lease-math assertions are
// added in the engine phase; this guards the import path used by every suite.

describe('lease-math', () => {
  it('imports backend services through the NodeNext .js convention', () => {
    expect(typeof monthlyPaymentKobo).toBe('function');
  });

  it('computes a positive integer monthly payment for an amortised lease', () => {
    const payment = monthlyPaymentKobo(1_200_000, 2800, 12);
    expect(Number.isInteger(payment)).toBe(true);
    expect(payment).toBeGreaterThan(0);
  });
});