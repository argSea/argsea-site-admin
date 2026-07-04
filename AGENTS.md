# AGENTS.md

## Purpose
The argSea admin interface — a react-admin (Vite + React + TypeScript) UI for
managing content served by `argsea-site-api`. It owns the admin UI only; it does
not own the API or the public site.

Status: this admin may be replaced (TBD). Prefer contained, low-investment
changes over large refactors unless a session explicitly says otherwise.

## Instruction Priority
Resolve instructions in this order:
1. an external session path assigned by the caravan primary integrator
2. local `SESSION.md`, if present
3. this `AGENTS.md`
4. task-relevant repo docs
5. source code
If instructions conflict, pause and ask.

## Boot Sequence
1. `AGENTS.md`
2. assigned external session path, if one was given
3. local `SESSION.md`, if present
4. `src/App.tsx` (react-admin resource wiring), then `src/dataProvider.ts` /
   `src/authProvider.tsx` for API/auth seams
5. only the files the task requires
Read narrowly. Do not wander the repo.

## Hierarchical Workflow
- An assigned external session is the authoritative task contract.
- Keep edits scoped to this repo unless the session explicitly allows more.
- Prefer a worktree over the primary checkout for a new branch.
- Branch name: `type/scope/short-desc`.
- Return implementation + verification evidence to the primary integrator.

## Operating Rules
- Stay inside the declared scope and exclusions.
- Preserve existing behavior unless the task changes it.
- Keep diffs reviewable and tied to the task.
- Update durable docs only when architecture/contracts materially change.
- Plain English in responses and session notes.
- API/auth access goes through `src/dataProvider.ts` and `src/authProvider.tsx`
  — keep react-admin's provider seam; don't scatter fetch calls into components.
- `.env` is tracked in git and holds the API base URL. Do NOT add secrets to it;
  anything sensitive must stay out of the repo.

## Repo Map
- `index.html`, `vite.config.ts` — Vite entry/config.
- `src/index.tsx` — app bootstrap.
- `src/App.tsx` — react-admin `<Admin>` + `<Resource>` wiring.
- `src/dataProvider.ts` — REST data provider against `argsea-site-api`.
- `src/authProvider.tsx` — auth flow.
- `src/components/`, `src/lib/`, `src/styles/` — UI, helpers, styling.
- `dist/` — build output (gitignored). `node_modules/` — deps (gitignored).

## Architecture Defaults
react-admin conventions: resources declared in `App.tsx`, backed by the data +
auth providers. Transport concerns stay in the providers, not components.

## Verification Rules
For touched behavior, run the smallest useful check for the changed surface:
- `npm run type-check` — `tsc --noEmit`, read-only; the default check.
- `npm run build` — `vite build`, confirms it compiles.
- `npm run lint` — eslint, but note it runs with `--fix` and WILL modify files;
  review what it changed before committing.
Don't claim a run you didn't do. `npm run deploy` scp's a build to the server —
never run it from a dispatched task.

## Session Discipline
- Small tasks: one agent.
- Multi-agent: the assigned external session (or local `SESSION.md`) is the
  parent contract; one primary integrator owns consolidation.
- With no session and no explicit implementation request, stay in planning mode.

## Final Output Expectations
Report: what changed, files changed, verification run, known limitations/
follow-ups, and assumptions a human should review. Plain English.
