# AGENTS.md

## Cursor Cloud specific instructions

This is a **Next.js 14 (App Router) + Prisma + PostgreSQL** employee-management/HRIS app.
Auth is handled by **Clerk** (`@clerk/nextjs` v4) via `middleware.ts`, which wraps the
entire app. Node `>=20 <23` and `npm` (lockfile is `package-lock.json`).

The update script (`npm install`) refreshes dependencies and regenerates the Prisma client
(`postinstall`/`predev` run `prisma generate`). Everything below is for starting/running the
app in a Cloud VM where deps are already installed.

### Local services (start each session; not started automatically)

- **PostgreSQL 16** is installed locally. Start it before running the app, tests that hit the DB, or Prisma commands:
  `sudo pg_ctlcluster 16 main start`
- Databases `employee_management` (app) and `employee_management_shadow` (Prisma shadow) already exist; user `postgres` password is `postgres`.
- A local `.env` (gitignored) is preconfigured with `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SHADOW_DATABASE_URL` pointing at the local Postgres, plus placeholder Clerk keys and base URLs.

### Database schema / seed (non-obvious)

- Apply schema with **`npx prisma db push`**, NOT `prisma migrate deploy`. The committed
  `prisma/migrations/` are ordered such that `migrate deploy` fails (a migration references the
  `Offices` table before the `baseline_init` migration that creates it). `db push` syncs the
  schema directly and works.
- Seed the salary table with `npx prisma db seed` (runs `prisma/seed/seed-salary.ts`).

### Standard commands (defined in `package.json`)

- Dev server: `npm run dev` (http://localhost:3000). `predev` runs `prisma generate`.
- Lint: `npm run lint` (passes with warnings only).
- Tests: `npm test` (Node test runner via `scripts/run-tests.mjs`). These are source-level
  unit tests and do NOT require a running DB or Clerk. Note: `tests/get-dashboard-summary-movements.test.ts`
  ("employment event query filters promoted and terminated events in range") currently fails as
  a **pre-existing** mismatch between the test's regex and the route source — it is unrelated to
  environment setup.

### Clerk auth limitation (important)

The placeholder Clerk publishable key resolves to a non-existent frontend API domain, so
Clerk's client JS fails to load and **every browser page renders blank** (the `ClerkProvider`
in `app/layout.tsx` wraps the whole app). Server-side rendering still works: routes under
`middleware.ts` `publicRoutes` (e.g. `/api/*` and `/(.*)/view/employee/(.*)`) return correct
server-rendered HTML (verifiable with `curl`). To exercise the full UI (sign-in + dashboard) in
a browser, set real Clerk keys `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

Most other integrations (Cloudinary, OpenAI/Genio, Pusher, Twilio/SMS, Google Drive, Meta,
PostHog, Neon API) are feature-gated and degrade gracefully when their env vars are absent.
