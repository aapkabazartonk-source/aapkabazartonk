# Aapka Bazar — Single Owner Authentication

## Architecture

- **Model:** one store owner account (`User` with `role: "owner"`).
- **Sessions:** sealed JWT cookies via [`jose`](https://github.com/panva/jose) (HttpOnly, `SameSite=Lax`, `Secure` in production).
- **Passwords:** Node `scrypt` hashes (`src/lib/password.ts`). Never stored in plaintext.
- **Protection:** `src/proxy.ts` redirects unauthenticated page traffic to `/login` and returns `401` for protected APIs. Every data API also calls `requireTenant()`, which validates the session server-side.
- **No public registration**, staff accounts, roles UI, or multi-store switching.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | Existing MongoDB connection |
| `SESSION_SECRET` | yes | ≥32 character random secret for signing session cookies |
| `OWNER_EMAIL` | bootstrap / reset | Owner email (never exposed to the frontend by setup scripts) |
| `OWNER_PASSWORD` | bootstrap / reset | Owner password for bootstrap or CLI reset |
| `OWNER_NAME` | optional | Display name on first bootstrap |

Generate a session secret:

```bash
openssl rand -base64 32
```

## First-time owner setup

1. Add the variables above to `.env.local` (local) or your host env (production).
2. Create the owner (does **not** overwrite an existing owner password):

```bash
npm run auth:bootstrap-owner
```

Equivalent:

```bash
OWNER_EMAIL=you@store.com OWNER_PASSWORD='your-strong-password' npm run auth:bootstrap-owner
```

3. Start the app and sign in at `/login`.

If you later change `OWNER_EMAIL` / `OWNER_PASSWORD` in `.env.local` after an owner already exists, sync the account:

```bash
npm run auth:sync-owner
```

## Local development

```bash
# 1. Ensure .env.local has MONGODB_URI, SESSION_SECRET, OWNER_EMAIL, OWNER_PASSWORD
npm run auth:bootstrap-owner
npm run dev
# Open http://localhost:3000/login
```

## Production deployment

1. Set `MONGODB_URI`, `SESSION_SECRET`, `OWNER_EMAIL`, and `OWNER_PASSWORD` in the host environment (not in the client bundle).
2. Run `npm run auth:bootstrap-owner` once against production MongoDB.
3. Unset or rotate `OWNER_PASSWORD` after bootstrap if your host stores one-shot secrets.
4. Deploy with `npm run build && npm start` (or your platform’s Next.js build).
5. Confirm cookies are `Secure` over HTTPS (`NODE_ENV=production`).

## Password recovery

Transactional email is **not** configured. Use the CLI reset:

```bash
OWNER_EMAIL=you@store.com OWNER_PASSWORD='new-strong-password' npm run auth:reset-owner-password
```

This hashes the new password, bumps `sessionVersion` (invalidating sealed sessions), and never prints the password back.

The `/forgot-password` page documents this flow for the owner.

## Session behaviour

| Action | Result |
| --- | --- |
| Sign in | Sets `ab_session` HttpOnly cookie (12h, or 30d with Remember me) |
| Refresh | Cookie remains; APIs re-validate signature + `sessionVersion` |
| Sign out | Clears cookie and increments `sessionVersion` so the sealed token cannot be reused |
| Password change / CLI reset | Increments `sessionVersion`; old cookies fail |

## Routes

| Path | Access |
| --- | --- |
| `/login`, `/forgot-password` | Public |
| `/register` | Redirects to `/login` (no registration) |
| `/dashboard/**`, `/invoice/**` | Authenticated |
| `/api/auth/login`, `/api/auth/logout` | Public |
| All other `/api/**` | Authenticated |
