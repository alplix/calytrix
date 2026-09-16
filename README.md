# Calytrix

Coded by Alperen Yavuz

Calytrix is an AI code reviewer for GitHub pull requests. Connect a repository, pick a pull
request, and get a structured review — bugs, security issues, performance problems, code
quality concerns, and missing test coverage — generated from the actual diff by Claude.

## Features

- Sign in with GitHub (OAuth)
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
- [Auth.js (next-auth)](https://authjs.dev) with the GitHub provider
- [Octokit](https://github.com/octokit/octokit.js) for the GitHub API
- [Anthropic SDK](https://docs.claude.com) (Claude) for the review itself
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
| `AUTH_SECRET` | Random secret used by Auth.js to sign sessions. Generate with `npx auth secret` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth App credentials |
| `ANTHROPIC_API_KEY` | Claude API key |
| `AUTH_URL` | Canonical app URL; required in production deployments |

`.env` is git-ignored. Never commit real secrets.

### GitHub OAuth setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**.
2. Homepage URL: `http://localhost:3000` (or your production URL).
3. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`.
4. Copy the generated **Client ID** and **Client Secret** into `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.

Calytrix requests the `read:user repo` scope. The `repo` scope is required to read diffs from
private repositories — GitHub has no read-only, PR-diff-only scope. If you only need public
repositories, you can narrow this to `public_repo` in [`src/lib/auth.ts`](src/lib/auth.ts).

### Claude API setup

1. Create a key at [console.anthropic.com](https://console.anthropic.com).
2. Put it in `ANTHROPIC_API_KEY`.

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
  `src/app/api`.
- `src/lib` — framework-agnostic logic: `github.ts` (GitHub API), `claude.ts` (AI review +
  response validation), `diff-filter.ts` (trims the diff before it's sent to the AI), `review.ts`
  (orchestrates fetching, caching, and persisting a review), `auth.ts` (Auth.js config), `errors.ts`
  (typed, user-safe error handling).
- `src/components` — UI components.
- `src/i18n` — locale configuration and the request-time locale/message resolver.
- `messages/*.json` — UI translations, one file per locale.
- `prisma/schema.prisma` — data model: `User`/`Account`/`Session` (Auth.js), `Repository`,
  `PullRequest`, `Review`, `Finding`.

A review is looked up by pull request + head commit SHA before calling the AI. If a completed
review already exists for that exact commit, it's returned from the database and Claude is not
called again — this keeps token usage low and reviews reproducible until the branch actually
changes.

## Possible future features

- Inline PR comments posted back to GitHub
- Team/organization accounts
- Re-running a review automatically on new commits (webhook-driven)
- Support for GitLab/Bitbucket
