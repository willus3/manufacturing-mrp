# Manufacturing MRP — Project Instructions

## Session Startup (Do This Every Time)

1. **Read memory** — Read `~/.claude/projects/C--Users-willu-Dev-manufacturing-mrp/memory/MEMORY.md` and any relevant linked memory files.
2. **Check git log** — `git log --oneline -10` to see what changed recently.
3. **Read the active feature spec** — If working on a V2 feature, read its spec in `docs/spec/v2/`. If no feature is in progress, ask the user what to work on.

Do NOT start coding until you've completed these steps. Summarize where things stand and confirm with the user before proceeding.

### V1 specs are reference only
The original spec files in `docs/spec/00-12` describe the V1 build, which is complete. Only read them when you need to understand how a specific module was designed — don't read them all at session start.

## Project Structure

- `server/` — Node.js + Express backend with Prisma ORM
- `client/` — React frontend (Vite + Tailwind + Shadcn/ui)
- `docs/` — Requirements and handoff docs
- `docs/spec/` — V1 build specification (numbered files 00–12, reference only)
- `docs/spec/v2/` — V2 feature specs (one per feature, self-contained)
- `docker-compose.yml` — Local PostgreSQL dev database

## V2 Workflow

### Feature specs
Each V2 feature has a focused spec in `docs/spec/v2/` that includes:
- What changes and why
- Which existing files are affected
- Integration points with other modules
- **Verification section** — concrete checks to run after implementation, including which subset of the 140 UAT/e2e tests (in `client/tests/e2e/`) cover the feature

### Model usage
- **Opus** — Architecture, planning, integration design, debugging complex issues
- **Sonnet** — Implementing planned features, writing tests, fixing known bugs, CRUD work
- Use plan mode to write the handoff artifact, then switch to Sonnet for execution

### Feature branches
V2 features use branches (`v2/feature-name`), developed and tested independently, then merged to main.

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

## E2E Test Suite

140 tests across 16 Playwright files in `client/tests/e2e/`. Run from `client/`:
- All tests: `npx playwright test`
- Single file: `npx playwright test tests/e2e/01-authentication.spec.js`
- Headed (visible): `--headed`
- Config: `workers: 1`, `fullyParallel: false`, chromium only
