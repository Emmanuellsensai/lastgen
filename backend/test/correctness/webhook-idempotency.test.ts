import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../../src/data/inMemoryRepository.js';

// Correctness suite: webhook idempotency
//
// Proves the fourth review gate: an ALAT notification is applied exactly once
// per transactionReference. Replays return success but never mutate state a
// second time, and the settlement is atomic (loan + asset + installment
// commit together through the state machine).

describe('webhook idempotency', () => {
  it('applies a reference once and ignores replays', async () => {
    const repo = new InMemoryRepository();
    const loan = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
    const amountKobo = 36_654_539;
    const balanceBefore = loan.balanceKobo;
    const historyBefore = (await repo.statusHistory('ast_biz_adaeze_frozen')).length;

    await repo.settleAlatWebhook('ref-replay-1', amountKobo, loan.id);
    const balanceAfterFirst = loan.balanceKobo;
    const paidAfterFirst = (await repo.scheduleFor(loan.id)).filter((i) => i.paidAt).length;

    expect(balanceAfterFirst).toBe(balanceBefore - amountKobo);
    expect(balanceAfterFirst).toBeGreaterThanOrEqual(0);
    expect(paidAfterFirst).toBeGreaterThanOrEqual(1);

    await repo.settleAlatWebhook('ref-replay-1', amountKobo, loan.id);
    expect(loan.balanceKobo).toBe(balanceAfterFirst);
    expect((await repo.scheduleFor(loan.id)).filter((i) => i.paidAt)).toHaveLength(paidAfterFirst);
    expect(await repo.statusHistory('ast_biz_adaeze_frozen')).toHaveLength(historyBefore);
  });

  it('applies a fresh reference normally', async () => {
    const repo = new InMemoryRepository();
    const loan = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
    const balanceBefore = loan.balanceKobo;

    await repo.settleAlatWebhook('ref-fresh-1', 1_000_000, loan.id);
    await repo.settleAlatWebhook('ref-fresh-2', 2_000_000, loan.id);

    expect(loan.balanceKobo).toBe(balanceBefore - 3_000_000);
  });

  it('routes a notification to the loan named in the narration', async () => {
    const repo = new InMemoryRepository();
    const target = (await repo.getLoan('loan_biz_wuse_press'))!;
    const other = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
    const targetBefore = target.balanceKobo;
    const otherBefore = other.balanceKobo;

    await repo.settleAlatWebhook('ref-narration-1', 5_000_000, `payment for ${target.id}`);

    expect(target.balanceKobo).toBe(targetBefore - 5_000_000);
    expect(other.balanceKobo).toBe(otherBefore);
  });

  it('rejects an unmatched notification when no pending payment or narration matches', async () => {
    const repo = new InMemoryRepository();

    await expect(
      repo.settleAlatWebhook('ref-unmatched-1', 1_000_000, 'no loan mentioned'),
    ).rejects.toThrow(/No pending payment or matching loan found/);
  });

  it('pays off a loan and transfers ownership atomically', async () => {
    const repo = new InMemoryRepository();
    const loan = (await repo.getLoan('loan_biz_wuse_press'))!;
    const asset = (await repo.getAsset(loan.assetId))!;
    const balance = loan.balanceKobo;
    const historyBefore = (await repo.statusHistory(asset.id)).length;

    await repo.settleAlatWebhook('ref-payoff-1', balance, loan.id);

    expect(loan.balanceKobo).toBe(0);
    expect(loan.status).toBe('CLOSED');
    expect(asset.status).toBe('OWNED');
    expect((await repo.statusHistory(asset.id)).length).toBeGreaterThan(historyBefore);
  });
});
