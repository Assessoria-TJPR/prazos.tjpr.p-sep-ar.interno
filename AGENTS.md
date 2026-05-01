# Repository Guidelines

## Project Structure & Module Organization
This repository is a flat, static web app. [`index.html`](./index.html) bootstraps React 18, Babel-in-browser, Tailwind, and Firebase SDKs, then loads the main modules in sequence. Core UI and workflow logic live in `app.js`, `login.js`, `components.js`, and the admin pages (`BugReportsPage.js`, `CalendarAdminPage.js`, `MinutasAdminPage.js`). Deadline rules are split by domain in `regrasCNJ.js`, `regrasCrime.js`, and `regrasCivel.js`; shared helpers live in `utils.js` and `contexts.js`. Styling and assets stay in `style.css`, `Logo.png`, `manifest.json`, and `sw.js`. Treat `playwright-report/`, `test-results/`, `out.json`, and `server.log` as generated artifacts unless your change explicitly refreshes them.

## Build, Test, and Development Commands
There is no packaged build step. Serve the repo as static files so service workers and Firebase behave correctly:

```bash
npx http-server -c-1 .
# Ou para hot-reload automático (atualiza a página ao salvar o arquivo):
# npx live-server .
```

Open the served `index.html` in a browser. For logic checks, run the standalone Node scripts directly, for example:

```bash
node test_dias_corridos.js
node test_recesso_crime_final.js
node verify_simple.js
```

For the browser smoke flow, generate the fixture and run the Playwright harness:

```bash
node create_test.js
node run_playwright.js
```

## Coding Style & Naming Conventions
Match the existing style: 4-space indentation, semicolons, and functional React components. Use `PascalCase` for React page/components (`CalendarAdminPage`) and `camelCase` for helpers and business-rule functions (`calcularPrazoFinalDiasCorridos`). Keep filenames descriptive and aligned with the current patterns: `*Page.js`, `regras*.js`, `test_*.js`, `verify_*.js`, and `debug_*.js`. Since there is no configured linter or formatter, preserve the surrounding formatting when editing.

## Testing Guidelines
Add focused regression scripts near the root and name them after the scenario under test, for example `test_result_15.js`. Prefer pure Node-based tests for date/rule logic and mock Firebase when the code path does not need live services. When a UI or browser behavior changes, capture the result with the existing Playwright flow and inspect `playwright-report/`.

## Commit & Pull Request Guidelines
Recent history favors short, imperative subjects, sometimes with a `fix:` or `Fix:` prefix, for example `fix: logic update for instability rule`. Keep commits scoped to one behavior change. PRs should state the affected rule or screen, summarize manual/automated validation, link the related issue or request, and include screenshots for UI changes.

## Security & Configuration Tips
`firebase-init.js` and `firestore.rules` affect live-backed behavior. Do not commit temporary credentials, debug logs, or ad hoc exports. Validate any change to holiday/decree logic against the relevant legal source before merging.
