// NIN verification seam.
//
// Identity verification against Nigeria's national identity database (NIMC)
// is an external integration the hackathon build cannot call, so it lives
// behind this provider seam: routes and repositories depend on the interface,
// deployments select the implementation with NIN_PROVIDER. The simulated
// provider validates the 11-digit format and passes — the same posture as the
// demo /auth/verify-nin shim — while keeping the swap-in point for a real
// adapter to a one-line factory change.

import { ApiError } from '../middleware/errorHandler.js';

export const NIN_LENGTH = 11;

export interface NinVerificationResult {
  /** True when the provider confirms the number against the identity record. */
  verified: boolean;
}

export interface NinProvider {
  verify(nin: string): Promise<NinVerificationResult>;
}

/** Format-only provider used in demo mode (and until NIMC is wired). */
class SimulatedNinProvider implements NinProvider {
  async verify(nin: string): Promise<NinVerificationResult> {
    if (!new RegExp(`^\\d{${NIN_LENGTH}}$`).test(nin)) {
      throw new ApiError('VALIDATION', `NIN must be ${NIN_LENGTH} digits`, 400);
    }
    return { verified: true };
  }
}

/** Real NIMC adapter placeholder — fails closed rather than passing blindly. */
class NimcNinProvider implements NinProvider {
  async verify(_nin: string): Promise<NinVerificationResult> {
    throw new ApiError(
      'UNAVAILABLE',
      'NIMC verification is not configured on this deployment',
      503,
    );
  }
}

export function ninProviderFor(name: string | undefined): NinProvider {
  return name === 'nimc' ? new NimcNinProvider() : new SimulatedNinProvider();
}
