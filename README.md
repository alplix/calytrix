# Calytrix

Coded by Alperen Yavuz

Calytrix is an AI code reviewer for GitHub pull requests. Connect a repository, pick a pull
request, and get a structured review — bugs, security issues, performance problems, code
quality concerns, and missing test coverage — generated from the actual diff by Tilvar, a
self-hosted chat model.

## Features

- Sign in with your Athena account ([athena.org.tr](https://athena.org.tr)) — shared single sign-on
  across all of Athena's tools (Calytrix, Tilvar, Vigil): sign in once on athena.org.tr and every
  `*.athena.org.tr` subdomain recognizes you via a shared cookie
- Connect GitHub separately (a real GitHub OAuth authorization, kept apart from your Athena
  identity) to unlock repo/PR access
- List repositories you have access to
- List and select pull requests for a repository
- Fetch a pull request's diff directly from the GitHub API
- AI review of the diff across five categories: bug, security, performance, code quality,
  missing tests
- Each finding includes severity, file, line (when available), a description, why it matters,
  and a suggested fix
- A clear "no significant problems found" result when the diff is clean
- Reviews are cached per commit (head SHA) in the database — reopening a pull request shows the
  previous result instantly instead of calling the AI again; a "Re-review" button forces a fresh
  pass
- Minimal GitHub OAuth scope, no tokens ever sent to the browser
- No local Calytrix accounts, passwords, or sessions — identity always comes from Athena
- Full UI translated into 30 languages, with automatic browser-language detection and a manual
  language switcher (see [Languages](#languages))

## Screenshots

| Landing page | Auto-detected language (Japanese) |
| --- | --- |
| ![Calytrix landing page](docs/screenshot-landing.png) | ![Calytrix in Japanese](docs/screenshot-i18n.png) |

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [PostgreSQL](https://www.postgresql.org) + [Prisma](https://www.prisma.io)
- Identity via [Athena](https://athena.org.tr)'s shared SSO (`GET /api/me` against the `tv` cookie)
  — no Auth.js/next-auth; GitHub repo access is a separate, direct OAuth authorization
  (see [Authentication](#authentication) below)
- [Octokit](https://github.com/octokit/octokit.js) for the GitHub API
- [Tilvar](https://athena.org.tr) (self-hosted chat model, called over its HTTP API) for the review itself
- [Zod](https://zod.dev) for validating AI output and API input
- [next-intl](https://next-intl.dev) for internationalization
- [Vitest](https://vitest.dev) for tests

## Installation

```bash
npm install
cp .env.example .env
# fill in .env, see "Environment variables" below
npx prisma migrate deploy
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret used to HMAC-sign the short-lived "Connect GitHub" OAuth `state` (see [`src/lib/oauth-state.ts`](src/lib/oauth-state.ts)). Generate with `npx auth secret` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth App credentials, used only for the separate "Connect GitHub" repo-access flow — not for identity |
| `TILVAR_API_KEY` | Tilvar API key (self-hosted model, see athena.org.tr) — used instead of a paid Anthropic key |
| `TILVAR_API_MAX_CHARS` | Max prompt characters sent to Tilvar per review; defaults to 40000 |
| `AUTH_URL` | Canonical app URL; required in production deployments. Used to build the GitHub OAuth callback URL and the Athena sign-in return URL |
| `ATHENA_BASE_URL` | Base URL of the Athena hub that owns identity; defaults to `https://athena.org.tr` |

`.env` is git-ignored. Never commit real secrets.

## Authentication

Calytrix has no accounts, passwords, or sessions of its own. Identity and repo access are two
separate concerns:

1. **Identity — your Athena account.** You sign in once on [athena.org.tr](https://athena.org.tr)
   (Google/GitHub/email), which sets a shared `tv` cookie on `.athena.org.tr` that every
   `*.athena.org.tr` subdomain — Calytrix included — can see. On each request, Calytrix asks
   `GET https://athena.org.tr/api/me` (forwarding the `tv` cookie) who you are; the result is
   cached in-process for 60 seconds, keyed by the full cookie value, so this doesn't mean a network
   round trip on every request. See [`src/lib/session.ts`](src/lib/session.ts) and
   [`src/lib/athena.ts`](src/lib/athena.ts). If you're not signed in to Athena, protected pages
   redirect to `https://athena.org.tr/giris?next=<return-url>`.
2. **Authorization — connecting GitHub.** Knowing who you are on Athena doesn't by itself grant
   access to your GitHub repositories. The first time you visit the dashboard, you'll see a
   "Connect GitHub" screen. Clicking it starts a direct GitHub OAuth authorization (no Auth.js/
   next-auth) — see [`src/app/api/auth/github/connect`](src/app/api/auth/github/connect) and
   [`src/app/api/auth/callback/github`](src/app/api/auth/callback/github). The exchanged access
   token is stored server-side against your Athena account row and is never sent to the browser.

### GitHub OAuth setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**.
2. Homepage URL: `http://localhost:3000` (or your production URL).
3. Authorization callback URL: `http://localhost:3000/api/auth/callback/github` (in production,
   `https://calytrix.athena.org.tr/api/auth/callback/github` — this path is load-bearing and must
   not change without reconfiguring the OAuth App).
4. Copy the generated **Client ID** and **Client Secret** into `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.

Calytrix requests the `read:user repo` scope. The `repo` scope is required to read diffs from
private repositories — GitHub has no read-only, PR-diff-only scope. If you only need public
repositories, you can narrow this to `public_repo` in
[`src/lib/github-oauth.ts`](src/lib/github-oauth.ts).

### Tilvar API setup

1. Get an API key for the self-hosted Tilvar model (see [athena.org.tr](https://athena.org.tr)).
2. Put it in `TILVAR_API_KEY`.

### PostgreSQL setup

Any PostgreSQL 14+ instance works — local, Docker, or a hosted service (Supabase, Neon, Railway,
RDS, etc.). Point `DATABASE_URL` at it, for example:

```
DATABASE_URL="postgresql://user:password@localhost:5432/calytrix?schema=public"
```

### Prisma migrations

```bash
npx prisma migrate deploy   # apply migrations (production/CI)
npx prisma migrate dev      # apply migrations and keep them in sync while developing
npx prisma studio           # inspect the database visually
```

## Development commands

```bash
npm run dev      # start the dev server
npm run lint     # ESLint
npm run test     # Vitest
npx tsc --noEmit # type-check
```

## Production build

```bash
npm run build
npm run start
```

## Languages

The UI is fully translated into 30 languages. On first visit, the language is picked from the
browser's `Accept-Language` header; visitors can override it with the language switcher in the
top bar, which is remembered in a cookie.

English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Romanian, Greek, Czech,
Slovak, Hungarian, Swedish, Danish, Finnish, Norwegian, Bulgarian, Croatian, Slovenian, Estonian,
Latvian, Lithuanian, Russian, Ukrainian, Turkish, Chinese (Simplified), Vietnamese, Japanese, Korean.

Translations live in [`messages/`](messages) as one JSON file per locale (e.g. `messages/de.json`).
To add a language, copy `messages/en.json`, translate its values, add the locale code to
[`src/i18n/config.ts`](src/i18n/config.ts), and add its display name to `localeLabels` in the same
file.

## Architecture

- `src/app` — routes (App Router): the landing page, the dashboard, and API route handlers under
  `src/app/api` (including the "Connect GitHub" OAuth routes under `src/app/api/auth`).
- `src/lib` — framework-agnostic logic: `github.ts` (GitHub API), `tilvar.ts` (AI review +
  response validation), `diff-filter.ts` (trims the diff before it's sent to the AI), `review.ts`
  (orchestrates fetching, caching, and persisting a review), `athena.ts` (Edge-safe Athena `/api/me`
  lookup + cache), `session.ts` (Node-only identity/GitHub-connection helpers built on `athena.ts`),
  `oauth-state.ts` (signs/verifies the "Connect GitHub" OAuth `state`), `github-oauth.ts` (direct
  GitHub OAuth calls), `errors.ts` (typed, user-safe error handling).
- `src/proxy.ts` — Edge-safe pre-check that bounces a visitor with no `tv` cookie at all straight
  to Athena sign-in before the dashboard renders; the authoritative check still happens per-request
  in `session.ts`.
- `src/components` — UI components.
- `src/i18n` — locale configuration and the request-time locale/message resolver.
- `messages/*.json` — UI translations, one file per locale.
- `prisma/schema.prisma` — data model: `User` (Athena account id + optional GitHub connection —
  see [Authentication](#authentication)), `Repository`, `PullRequest`, `Review`, `Finding`.

A review is looked up by pull request + head commit SHA before calling the AI. If a completed
review already exists for that exact commit, it's returned from the database and Tilvar is not
called again — this keeps request volume low and reviews reproducible until the branch actually
changes.

## Possible future features

- Inline PR comments posted back to GitHub
- Team/organization accounts
- Re-running a review automatically on new commits (webhook-driven)
- Support for GitLab/Bitbucket
