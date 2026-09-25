# argsea-site-admin

The Keeper's Office: the back office for [argsea.com](https://argsea.com).
A Vite + React 19 + TypeScript single-page app, night-harbor themed, talking to
the `argsea-site-api` Go backend. No router, no UI kit, no rich-text editor.

## Screens

In rail order. The lantern is the one row that is not a screen.

| screen | what it does |
| --- | --- |
| login | "keepers only", JWT via `POST /1/auth/login/` |
| the watch room | greeting, stat tiles off the sightings API, keeper's log, quick errands |
| the watch desk | the current-watch singleton: title, letter, rotation, up to three bearings, two postcard hooks, a live preview |
| the light list | project CRUD, rack order, the front window (featured, max 3), draft ⇄ publish, plus the coast tab's drag-to-place wall |
| the wandering chart | hobby CRUD across five states, on-watch ⇄ off-the-fairway, reorder, the suggestion pool |
| the chart table | the one home for every berth field (coord, wake origin, plate, caption) over lights, hobbies and notes together |
| writing desk | note CRUD with draft ⇄ publish, plain textarea over `<p>`-wrapped storage, doodle chip |
| the tool bench | the keeper's stores as drawers of tools on the copy singleton, four drawers at most |
| marginalia | the doodle shelf and its pen/pencil editor, shapes as JSON never markup |
| the carving shop | one bench that is the editor: raw-SVG carvings bolted onto site spots, seeds unchangeable |
| the darkroom | media upload/delete with usage badges and detach-on-delete |
| signal flags | the SiteCopy singleton's text fields, saved as you type |
| the keeper | profile fields on the user doc, saved as you type, plus the Gull Post masthead |
| the papers | the resume shelf: stored PDF cuts with private notes, at most one published, publish/unpublish, edit, scrap |
| smuggler's cove | the easter-egg flags, the cat's rounds, the proverbs and the light list |
| the lantern | deploy: hoist, poll, rollback; a sidebar panel, not a screen |

## Run it

```bash
npm install
echo 'VITE_ARGSEA_API_URL=http://localhost:8181' > .env   # your API origin
npm run dev                                               # http://127.0.0.1:5173
```

Local dev auths with the bearer token (the API's cookie domain is prod-only).
API recipe (tunnel, config, flags) lives in the argsea-site-api README.

## Verify

```bash
npm run type-check    # tsc --noEmit
npm run build         # vite build
npm test              # playwright, mock API via route interception, no live API
```

First test run may need `npx playwright install chromium`.
