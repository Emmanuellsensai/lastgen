# Contributing

These rules exist so several people (and several coding agents) can work on LastGen
at the same time without overwriting each other. They are not suggestions.

## 1. Ownership is by directory

Every contributor is assigned a set of paths. You edit files inside your assigned
paths and nowhere else. If a change you need lives outside your paths, ask the owner
of that directory to make it. Do not "just fix it quickly" in someone else's folder.

Current ownership map:

| Area              | Paths                          | Owner |
| ----------------- | ------------------------------ | ----- |
| Frontend          | `frontend/**`                  | _TBD_ |
| Backend           | `backend/**`                   | _TBD_ |
| Data              | `supabase/**`                  | _TBD_ |
| Tests             | `tests/**`                     | _TBD_ |
| Docs and contract | `docs/**`, root markdown files | _TBD_ |

Shared root config (`package.json`, `eslint.config.js`, `.prettierrc`,
`pnpm-workspace.yaml`) changes only by agreement, in its own PR.

## 2. Never edit files outside your assigned paths

Repeat of rule 1 because it is the rule that gets broken. A PR that touches paths you
do not own gets closed, not reviewed.

## 3. Branch from latest `main`

```bash
git checkout main
git pull --ff-only
git checkout -b <area>/<short-description>
```

Always pull `main` immediately before branching. Never branch from another feature branch.

## 4. Commit small and push often

Small commits with a clear message, pushed at least every time a unit of work is done.
Long-lived unpushed branches are how merge conflicts happen. If you have been working
for an hour without pushing, push now.

## 5. The contract is the source of truth

`docs/CONTRACT.md` defines the API shape shared between frontend and backend. Neither
side changes it unilaterally. Frontend builds against MSW mocks that match the contract;
backend builds against the same contract. If the contract must change, change the doc
first, announce it, then change the code.
