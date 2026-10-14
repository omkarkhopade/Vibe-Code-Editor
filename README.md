# Vibe Code Editor

AI-assisted browser IDE built with Next.js 16.3.8, React 19.3, TypeScript 6, Auth.js 5 beta, Prisma 6.19.3/MongoDB, Monaco, WebContainers and Ollama. Existing layouts and styling are retained.

Features include Google/GitHub sign-in, owner-scoped playgrounds, six starter templates, persisted source trees, file editing, browser execution, code completion and streaming AI chat. See the current [functional completeness report](docs/functional-completeness-report.md) for the interaction matrix, verified journeys and remaining release blockers.

## Architecture

- `app/`: App Router pages and auth, template, chat, completion and health endpoints.
- `modules/dashboard` and `modules/playground`: UI, server actions, file validation and editor state.
- `modules/ai/lib`: shared Ollama configuration, bounded requests and NDJSON parsing.
- `modules/webcontainers`: browser-only runtime, preview processes and terminal.
- `lib/`: Prisma singleton, ownership guards, error responses and starter mapping.
- `prisma/schema.prisma`: users/accounts/sessions, playgrounds, saved source and favorites.
- `vibecode-starters/`: six required starter snapshots and upstream license. Other local starters remain ignored.

Generated code runs inside browser WebContainers. The Next.js server does not execute it. Saved source lives in MongoDB; template requests read bundled assets in memory without temporary output files.

## Local setup

Use Node.js 24 and npm. On Windows PowerShell, use `npm.cmd`/`npx.cmd` if execution policy blocks npm.ps1. Do not overwrite existing environment files.

1. Configure local environment variables using [.env.example](.env.example) as a reference. Preserve existing secrets.
2. Run `npm ci` in a clean checkout. Postinstall generates Prisma Client and prepares local Monaco assets.
3. Configure MongoDB with a replica set, network allowlists and TLS. Prisma uses DATABASE_URL; Next.js and prisma.config.ts load the Next.js environment conventions.
4. Configure Google and/or GitHub OAuth apps. Local callbacks are `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/github`. Use your HTTPS origin in production.
5. Start the already-installed Ollama service and verify `ollama list` contains `gpt-oss:20b`. The application does not download models.
6. Run `npm run dev` and open `http://localhost:3000`.

No database migration was applied. Before provisioning a new database, review schema/index compatibility and backups; an operator may then explicitly approve and run `npx prisma db push`. Never reset a populated database to troubleshoot it. Existing CUID IDs, collection names and stored template enums remain unchanged.

## Environment

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Private MongoDB URL with database and replica-set configuration |
| AUTH_SECRET | Strong random server-side session secret |
| AUTH_URL | Local or production application origin |
| AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET | Google OAuth configuration |
| AUTH_GITHUB_ID / AUTH_GITHUB_SECRET | GitHub OAuth configuration |
| OLLAMA_BASE_URL | Server-reachable endpoint; development default is http://127.0.0.1:11434 |
| OLLAMA_MODEL | Defaults to gpt-oss:20b; unavailable models produce a controlled error |
| OLLAMA_TIMEOUT_MS | Default 180000; allowed range 1000–600000 |

These variables must not use a NEXT_PUBLIC prefix. Production requires OLLAMA_BASE_URL explicitly. Chat discovers installed Ollama models and submits the selected model. OLLAMA_MODEL remains the default and the completion model. Optional OLLAMA_ALLOWED_MODELS is a comma-separated allowlist; include the default model. Cloud providers are not supported.

## AI behavior

Chat returns JSON with streaming off and incremental NDJSON with streaming on. Only response tokens are forwarded; reasoning fields are not exposed. Completion remains JSON and uses a dedicated cursor-insertion system prompt that preserves whitespace and avoids duplicating surrounding source. Requests use a 4096-token context and at most 1024 generated tokens. There is no automatic model switch or generation retry. Cancellation propagates upstream.

Each process admits one generation and each user up to ten AI requests per minute. Multiple workers require shared admission/rate controls before scaling. Prompts are size-limited; long chats require shortening. In-stream failures are error records after HTTP headers have been sent.

The audit machine had a 13.8 GB model file and returned a minimal OK response in approximately 160 seconds. This verifies connectivity, not acceptable interactive throughput. No models were installed or changed.

## Checks

```sh
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run build
npm run test:browser
npm audit
npm start
```

Tests use Node's test runner and the installed TypeScript compiler. They cover filesystems, authorization, failed saves, full-path editing, error mapping, AI limits, streaming and cancellation. Database/session boundaries are mocked unless explicitly stated.

Explicit read-only diagnostic against a known playground:

```sh
node tests/verify-live-template.mjs YOUR_PLAYGROUND_CUID
```

This stubs the session boundary using the record's owner; it does not verify OAuth. The optional `--baseline` flag is useful only while Git HEAD contains the original faulty route.

## Production and troubleshooting

See [deployment notes](docs/deployment.md). A successful build is not a verified deployment. CI checks types, lint, tests, build and dependency advisories. Known high development-tool advisories currently fail its audit gate.

- `GET /api/health`: public process liveness. Authenticated `GET /api/health?ready=1`: MongoDB/model availability, without inference.
- Template failure: the NEXTJS path now points to the bundled nextjs directory. All six starter directories must be deployed.
- 401/404: verify sign-in and ownership. Foreign and absent playgrounds intentionally share not-found behavior.
- Database unavailable: verify DNS/network access, allowlists, credentials, replica-set and TLS settings without printing connection strings.
- AI 429: wait for active inference/rate limits. AI 503/504: verify service, installed model and hardware capacity.
- Auth.js UntrustedHost in production: set AUTH_URL to the explicit application origin before npm start. Do not enable blanket host trust to hide a missing configuration.
- Prisma EPERM on Windows: stop this project's dev/production server before regenerating its native client.
- Font build failure: permit build-time Google Fonts access. Existing Geist fonts were not replaced.
- Preview failure: inspect terminal output. Browser WebContainer support and network access for starter npm installs are required. Starter packages need independent security/compatibility review.

## GitHub import

Open Github Repository on the dashboard imports a Node.js source snapshot from an HTTPS GitHub repository URL, with an optional branch/ref. The project must have a root package.json with a dev or start script. Imports resolve to a fixed commit and create an owned playground; they do not sync or push changes.

Public repositories are supported. Private repositories require a linked GitHub OAuth account whose existing token has repository access; the application does not request additional scopes automatically. Tokens remain server-side. Imports permit 200 text files, 4 MB total, and 1 MB per file. Environment/key files, known binary assets, symlinks, submodules and generated directories are excluded. These filename filters are not a comprehensive secret scanner. Incomplete or oversized trees are rejected. Dependencies and scripts execute only in the browser WebContainer when the playground runs. Native dependencies or required omitted assets may need manual adaptation.

## Settings, persistence and browser verification

`/settings` saves your display name to your account and saves font size, tab size, word wrap and chat-model preference per account in the current browser. Source editing uses explicit Save / Save All; stale concurrent saves are rejected. Chat history is session-local and can be exported.

For GitHub access, use Settings ? Connect / reconnect GitHub, then Refresh GitHub status. Reauthorization persists the newly verified credential. Public imports can recover anonymously from a revoked token. Browse repositories in the dashboard import dialog; private access depends on existing authorization.

`npm run test:browser` runs Chrome against the production build on port 3107 with a synthetic session, in-memory database and provider fixtures. Install Chrome first (or set `PLAYWRIGHT_CHANNEL` to another installed compatible channel). Set `TEST_PREVIEW=1` to additionally verify real WebContainer serving, restart/reload and terminal execution; StackBlitz/npm network access is required. Screenshots are written to ignored `test-results/`. This does not verify your real OAuth account or mutate your database.

`npm run prepare:editor` copies the installed Monaco distribution and license into generated `public/monaco/`. It includes a narrowly scoped cancellation workaround for Monaco 0.57.0 and intentionally fails if an upgrade requires reviewing that patch. Deploy generated public assets with the build. Do not omit install/build lifecycle scripts without preparing these assets yourself.

Preview uses live editor buffers and updates changed files for dev-server watchers. Restart server uses current edits; Reload preview refreshes the page after synchronizing files. Use Save / Save All to retain changes when reopening the playground. Plain Node servers without a watcher need Restart server to reload their JavaScript.

API-only imports can return JSON instead of a UI. Import does not provision databases, environment secrets or native Node addon support. Startup failures leave the terminal visible. Backends requiring native addons (such as native bcrypt) need a regular compatible Node runtime or a separately reviewed browser-compatible adaptation.
