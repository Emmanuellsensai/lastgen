# Lastgen backend

Express + TypeScript API.

```bash
cp .env.example .env
pnpm --filter @lastgen/backend dev
```

Only `/health` is implemented in this pass:

```bash
curl http://localhost:8080/health
# {"ok":true}
```

## Layout

```
src/routes/      one router per contract domain
src/services/    business logic, no Express types
src/adapters/    external providers behind an interface
src/middleware/  cross cutting concerns
src/lib/         supabase client, logger, config
src/types/       shared types
```

## Deploy

Rendered from `render.yaml` (free tier web service, `rootDir: backend`).
Render reads blueprints from the repository root, so either move this file to the
root or point the Render dashboard at it explicitly.
