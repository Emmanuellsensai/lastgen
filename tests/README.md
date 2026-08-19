# Tests

Vitest + Supertest. Run from the repo root:

```bash
pnpm test
```

## Layout

- `contract/` — one suite per contract domain. These assert that the API matches
  `docs/CONTRACT.md`: status codes, response shape, error envelope. They are the
  shared truth between frontend and backend.
- `correctness/` — behaviour that must hold regardless of transport. Money math,
  state machines, idempotency, guard rails, cross-view parity.

Every suite file starts empty on purpose. Fill them in as the matching domain lands.

## Conventions

- Contract suites hit the Express app through Supertest, never a live server.
- Correctness suites import the unit under test directly, no HTTP.
- No test may depend on live Supabase or a live payment provider.
