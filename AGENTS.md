# AGENTS.md

## Purpose
The argSea admin: "The Harbormaster's Office", the night-harbor back office
for argsea.com. A single-page Vite + React 19 + TypeScript app and a live
client of the `argsea-site-api` Go backend. It owns the admin UI and its
client behavior; it does not own the API, its data model, or the public site.
No router, no UI kit, no rich-text editor; one shell with screen state and
bespoke CSS, translated value-for-value from the design.

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
4. `design/Admin.dc.html` in the argsea-site repo (the design ground truth)
   when touching anything visual
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

## Repo Map
- `index.html` / `vite.config.ts`: the Vite shell; nothing clever.
- `src/main.tsx`: fonts (`@fontsource`, self-hosted), global CSS, mount.
- `src/App.tsx`: the shell: login gate, sidebar + main pane, screen switch,
  footer, overlays, toast. One screen state, no router.
- `src/lib/api.ts`: the data seam. The ONLY module that fetches. Wire types
  mirror the API domain structs; the contract sharp edges (trailing slashes,
  auth-on-every-read, PUT full-replace, bare entities) are honored here.
- `src/lib/paragraphs.ts`: the `<p>` adapter between textarea plain text and
  the API's sanitized-HTML body storage (no rich-text editor, by ruling).
- `src/lib/stamp.ts` / `src/components/Stamp.tsx`: the stamp designer
  vocabulary (the API's closed enums) and renderer.
- `src/lib/`: also `prints.ts` (media display), `time.ts`, `whimsy.ts`,
  `useEscapeKey.ts`.
- `src/state/harbor.tsx`: the harbor store: one provider owning all office
  state and every API-calling action. Screens read from it and stay thin.
- `src/screens/`: one file per screen: `Login`, `Bridge`, `Postcards`,
  `Graveyard`, `WritingDesk`, `SignalFlags`, `SmugglersHold`, `FigureheadShop`,
  `Darkroom`, `Keeper`. The shop's editor lives in
  `src/components/ShapeEditor.tsx` over `src/lib/shapes.ts` (path anchor model,
  baked transforms, pencil smoothing); shapes are the frozen figurehead
  contract's JSON, never markup.
- `src/components/`: shared chrome: `Sidebar` (nav + the lantern + the cat),
  `EditOverlay`, `PeekOverlay`, `art.tsx`.
- `src/styles/global.css`: night-harbor tokens, shared vocabulary classes,
  keyframes, and the reduced-motion kill-switch (keep it last).
- `tests/`: Playwright specs against `tests/mock-api.ts`, a route-intercepted
  in-page mock of the API contract. No live API anywhere in the suite.

## Architecture Defaults
- All API access goes through `src/lib/api.ts`; the API origin comes from
  `VITE_ARGSEA_API_URL` (`.env`, untracked; defaults to `localhost:8181`).
- Send the bearer token on EVERY read; unauthenticated reads are
  published-only and drafts silently vanish otherwise.
- PUT is full-replace: always send the complete document. Lifecycle fields
  (status/publishedAt, project order/featured) are preserved server-side.
- Draft ⇄ publish goes through the lifecycle endpoints, never PUT. Restoring
  a revision goes through the restore endpoint (copy-forward); a plain PUT
  would preserve lifecycle and the printing's status would not travel.
- Note/project bodies are plain textareas over `<p>`-wrapped storage via
  `src/lib/paragraphs.ts`. Never render API HTML with innerHTML here.
- `prefers-reduced-motion: reduce` must disable all animation/transitions
  everywhere. Elements whose resting pose is a transform carry it via
  `--tilt` so the kill-switch never breaks layout.
- Fonts are self-hosted via `@fontsource` packages; no CDN fonts.

## Verification Rules
- `npm run type-check`: `tsc --noEmit`, zero errors.
- `npm run build`: must be green.
- `npm test`: the Playwright suite (starts its own dev server, mock API via
  route interception; needs Playwright's chromium installed).
- For visual changes: `npm run dev` and spot-check against
  `design/Admin.dc.html` in argsea-site.

## Session Discipline
- Small tasks: one agent.
- Multi-agent: the assigned external session (or local `SESSION.md`) is the
  parent contract; one primary integrator owns consolidation.
- With no session and no explicit implementation request, stay in planning mode.

## Final Output Expectations
Report: what changed, files changed, verification run, known limitations/
follow-ups, and assumptions a human should review. Plain English.
