// Payment provider interface. Chosen at runtime via PAYMENT_ADAPTER.
// Placeholder in this pass: shapes are defined by docs/CONTRACT.md.

export interface PaymentAdapter {
  readonly name: 'simulated' | 'alat';
}
