# Contributing to Gantry

Thanks for your interest! Gantry is a developer portal for Kong Gateway 3.9.
Before you start, read `README.md` — especially the **core concepts** section;
most design decisions follow from it.

## Dev setup

See "Dev setup" in `README.md`. Short version: you need a running Kong 3.9
(admin API reachable), PostgreSQL, and optionally Prometheus. Then:

```bash
cp .env.example .env.local   # set AUTH_SECRET, DATABASE_URL, KONG_ADMIN_URL, ...
npm install
npm run db:migrate
npm run seed:admin
npm run dev
```

## Ground rules

1. **Kong is the source of truth for routing and credentials.** The portal
   never creates or mutates Kong **services/routes** — it only touches
   entities tagged `devportal` (consumers, their credentials, ACLs,
   rate-limiting/request-termination plugins). Don't add code to
   `src/lib/kong.ts` that crosses this boundary without an explicit
   maintainer decision.
2. **Credential secrets are never stored** in the portal database — only the
   Kong credential id plus a 4-char hint. Keep it that way.
3. **All Kong Admin API calls go through `src/lib/kong.ts`**, all Prometheus
   queries through `src/lib/metrics.ts`. Both are server-side only.
4. **No hardcoded UI strings** on public/developer pages — use next-intl
   (`useTranslations` / `getTranslations`) and add keys to both
   `messages/en.json` and `messages/id.json`. (Admin pages are currently
   English-only; extracting them is an open backlog item.)
5. **Destructive actions need a confirm dialog** — pass `confirm="..."` to
   `PendingButton`.
6. **Themes are CSS-variable overrides.** To add one, follow "Creating a
   custom theme" in `README.md` — don't fork components per theme.

## Verifying changes

Run `npm test` (vitest), but unit tests are not enough for gateway-facing
changes: verify end-to-end against a real Kong — call the proxy and observe
the actual 200/401/403/429. This pattern was used for every feature in the
repo and is expected of new ones.

Notes that will save you time:

- Next.js 16: middleware lives in `src/proxy.ts` (not `middleware.ts`);
  read `AGENTS.md` — this version differs from most training data / older docs.
- If an edit to `globals.css` or `next.config.ts` seems to have no effect,
  Turbopack's cache is stale: `rm -rf .next` and restart the dev server.
- Detect Drizzle unique violations with `isUniqueViolation()` — the SQLSTATE
  may be on `err.code` or `err.cause.code`.

## Pull requests

- Keep PRs focused; one concern per PR.
- State what you verified and how (test output, proxy status codes,
  screenshots for UI changes).
- Database changes: edit `src/db/schema.ts`, then `npm run db:generate` and
  commit the generated migration under `drizzle/`.
