# QA report

## Coverage summary

| Area           | Suites | Tests | Status     |
| -------------- | ------ | ----- | ---------- |
| Contract       | 20     | 178   | ✅ PASS     |
| Correctness    | 4      | 54    | ✅ PASS     |
| Data / Stub    | 1      | 7     | ✅ PASS     |
| End-to-end     | 1      | 5     | ✅ PASS     |
| Live (opt-in)  | 1      | 16    | ⏭️ SKIPPED |
| **Total**      | **27** | **260** | ✅ **244 passed, 16 skipped** |

All tests live in `backend/test/` and run via `pnpm test`.

The live suite talks to a real Supabase project and is skipped unless you opt
in explicitly:

```bash
RUN_LIVE_E2E=true pnpm exec vitest run backend/test/live/live-e2e.test.ts
```

Everything else runs offline against the in-memory repository and the
deterministic seed, so results are reproducible without credentials.

## What CI runs

`.github/workflows/ci.yml` gates every pull request on:

| Step                       | Command                                     |
| -------------------------- | ------------------------------------------- |
| Backend typecheck (src)    | `pnpm --filter @lastgen/backend typecheck`   |
| Backend typecheck (tests)  | `pnpm --filter @lastgen/backend typecheck:test` |
| Lint                       | `pnpm lint`                                  |
| Shared correctness suites  | `pnpm exec vitest run backend/test/correctness` |
| Backend suites             | `pnpm --filter @lastgen/backend test`        |
| Backend format check       | `pnpm format:check:backend`                  |

The frontend is typechecked and built by its own `pnpm --filter @lastgen/frontend build`
(`tsc --noEmit && vite build`), which Vercel runs on each deploy.

## Keeping this file honest

The counts above are a snapshot. Regenerate them with:

```bash
pnpm --filter @lastgen/backend test
```
