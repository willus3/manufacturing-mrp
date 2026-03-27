# Manufacturing MRP — Project Instructions

## Session Startup (Do This Every Time)

1. **Read memory files** — Check `~/.claude/projects/C--Users-willu-Dev-manufacturing-mrp/memory/MEMORY.md` and read any relevant memory files to understand project context, build progress, and prior feedback.
2. **Read the manifest** — Read `docs/spec/MANIFEST.md` to understand which spec files map to which build phases.
3. **Determine current phase** — Check `memory/project_build_progress.md` for what's been completed and what's next.
4. **Read required spec files** — Based on the current phase, read all spec files listed in the manifest's Phase-to-File Map before writing any code.
5. **Read the requirements docs** — Review `docs/mrp-system-handoff-summary.md` and `docs/mrp-system-requirements.md` for product context.

Do NOT start coding until you've completed these steps. Summarize where things stand and confirm with the user before proceeding.

## Project Structure

- `server/` — Node.js + Express backend with Prisma ORM
- `client/` — React frontend (Vite + Tailwind + Shadcn/ui)
- `docs/` — Requirements and handoff docs
- `docs/spec/` — Full build specification (numbered files 00–12)
- `docker-compose.yml` — Local PostgreSQL dev database

## Development Environment

- Local Postgres runs via Docker on **port 5433** (not 5432 — local conflict)
- Always run Prisma commands from the `server/` directory
- Use `.js` script files instead of `node -e` for any scripting (Git Bash breaks multiline `node -e`)
- Git Bash on Windows — watch for path translation gotchas

## Coding Standards

- ES6+ syntax (const/let, arrow functions, template literals)
- camelCase for variables/functions, PascalCase for components, UPPER_SNAKE_CASE for constants
- Functions max 40 lines, single responsibility
- Add comments explaining complex logic (why, not what)
- WCAG 2.1 AA accessibility is non-negotiable even at prototype stage
- See `docs/spec/11-code-quality.md` for full standards

## Tech Stack

PostgreSQL + Prisma + Node.js/Express + React (Vite) + Tailwind + Shadcn/ui + TanStack Query + TanStack Table
