import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../../src/data/inMemoryRepository.js';
import { computeWrapped } from '../../src/services/impactEngine.js';

// Correctness suite: impact parity
// backend repo.impactFor must reproduce the MSW reference impact figures for
// the same first-build seed. The reference numbers below were captured from
// frontend/src/mocks/handlers.ts impactFor() against the frontend first build.

const repo = new InMemoryRepository();

describe('impact parity', () => {
  it('reproduces the demo business month figures', async () => {
    expect(await repo.impactFor('biz_adaeze_frozen', 'month')).toEqual({
      litresDisplaced: 419,
      co2KgAvoided: 967.9,
      nairaSavedKobo: 48185000,
      kwhGenerated: 1729.2,
      monthsToOwnership: 10,
    });
  });

  it('reproduces the demo business year figures', async () => {
    expect(await repo.impactFor('biz_adaeze_frozen', 'year')).toEqual({
      litresDisplaced: 5099,
      co2KgAvoided: 11778.7,
      nairaSavedKobo: 586385000,
      kwhGenerated: 5121,
      monthsToOwnership: 10,
    });
  });

  it('reproduces the demo business all-time figures', async () => {
    expect(await repo.impactFor('biz_adaeze_frozen', 'all')).toEqual({
      litresDisplaced: 10198,
      co2KgAvoided: 23557.4,
      nairaSavedKobo: 1172770000,
      kwhGenerated: 5121,
      monthsToOwnership: 10,
    });
  });

  it('a business with no asset reports zero generation and ownership', async () => {
    expect(await repo.impactFor('biz_bilikisu_tailor', 'month')).toEqual({
      litresDisplaced: 158,
      co2KgAvoided: 365,
      nairaSavedKobo: 18170000,
      kwhGenerated: 0,
      monthsToOwnership: 0,
    });
  });

  it('reproduces a financed non-demo business year figures', async () => {
    expect(await repo.impactFor('biz_gwarinpa_mart', 'year')).toEqual({
      litresDisplaced: 7475,
      co2KgAvoided: 17267.3,
      nairaSavedKobo: 859625000,
      kwhGenerated: 6816.9,
      monthsToOwnership: 8,
    });
  });

  it('the wrapped report projects the same yearly impact', async () => {
    const wrapped = computeWrapped({
      year: 2025,
      impact: await repo.impactFor('biz_adaeze_frozen', 'year'),
      now: await repo.now(),
    });
    expect(wrapped).toEqual({
      year: 2025,
      nairaSavedKobo: 586385000,
      litresNotBurned: 5099,
      co2KgAvoided: 11778.7,
      kwhGenerated: 5121,
      monthsToOwnership: 10,
      bestMonth: 'March',
      rank: 12,
    });
  });
});
