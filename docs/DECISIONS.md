# Decision log

Append-only. One entry per decision, newest at the bottom. Keep entries short.

## Template

### YYYY-MM-DD — Title

**Context:** what forced the decision.
**Decision:** what we chose.
**Consequence:** what this makes easy, and what it makes hard.

---

### 2026-08-19 — pnpm workspaces over a single package

**Context:** frontend and backend are deployed to different platforms and owned by
different people.
**Decision:** pnpm monorepo with `frontend` and `backend` as workspaces.
**Consequence:** independent deploys and dependency sets; shared lint and format config
lives at the root and changes by agreement.
