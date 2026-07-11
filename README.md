# argsea-site-admin

The Harbormaster's Office: the back office for [argsea.com](https://argsea.com).
A Vite + React 19 + TypeScript single-page app, night-harbor themed, talking to
the `argsea-site-api` Go backend. No router, no UI kit, no rich-text editor.

## Screens

| screen | what it does |
| --- | --- |
| login | "keepers only", JWT via `POST /1/auth/login/` |
| the watch room | greeting, stat tiles, keeper's log, quick errands |
| postcards | project CRUD, rack order, the mantel (featured, max 3), stamp designer |
| the graveyard | hobby CRUD, retire/revive, suggestion pool |
| writing desk | note CRUD, plain textarea over `<p>`-wrapped storage |
| signal flags | the SiteCopy singleton, saved as you type |
| the figurehead shop | SVG shape editor for the harbor cat: drafts, versions, one published per pose |
| the darkroom | media upload/delete with usage badges and detach-on-delete |
| the keeper | profile fields on the user doc, saved as you type |
| the lantern | deploy: hoist, poll, rollback; lives in the sidebar |

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
