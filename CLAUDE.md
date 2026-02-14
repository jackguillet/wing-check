# Wing Check — Claude Code Guidelines

## Workflow

- **Always push changes to the Vercel app when finished.** After committing, run `git push` so the deployment goes live.
- **Always run `db:push` after schema changes.** drizzle-kit needs env vars loaded: `source <(grep -v '^#' .env.local | sed 's/^/export /') && npx drizzle-kit push`

## Project

- Next.js app (App Router) with Drizzle ORM + Turso (LibSQL)
- Auth via better-auth; `getSession` / `requireSession` in `src/lib/auth-session.ts`
- Server actions in `src/lib/actions/`
- UI: shadcn/ui components + lucide-react icons + Tailwind CSS

## Commands

- `npm run build` — production build (catches TypeScript errors)
- `npm test` — vitest (evaluator tests)
- `npm run db:push` — push schema to Turso (needs TURSO_DATABASE_URL)
