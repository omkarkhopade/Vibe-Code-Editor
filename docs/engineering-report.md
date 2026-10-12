# Engineering report — Vibe Code Editor

Audit date: 2026-10-12. Work performed directly in the existing repository. The initial working tree was clean. No production deployment, database mutation/migration, model download or secret overwrite was performed.

## 1. Executive summary

Fixed the reported template-loading failure and verified the correction against the reported real playground with read-only MongoDB access. Hardened ownership checks and OAuth account handling, fixed source-file/save races, centralized bounded Ollama requests with streaming, preserved visual styling, and added regression tests, health checks, CI and deployment documentation.

The application builds successfully, but it is not certified production-ready: browser/OAuth E2E and visual screenshots remain unverified, dependency advisories remain, and local inference latency is poor.

## 2. Critical bugs fixed

| Problem / root cause | Fix and affected files | Evidence |
| --- | --- | --- |
| Reported NEXTJS record mapped to absent nextjs-new directory | lib/template.ts maps NEXTJS to existing nextjs; app/api/template/[id]/route.ts scans in memory | Real record exists and has NEXTJS. Original route/mapping returned 500/ENOENT; corrected handler returned 200 with valid structure. Session boundary stubbed; MongoDB real/read-only. |
| Shared output/TEMPLATE.json created race and read-only deployment risk | Removed request-time JSON write/read/unlink; all fallible route operations inside error boundary | Eight concurrent route calls produced identical successful results; missing directory/database failures handled. |
| Unauthenticated/unowned read, save, edit, delete, duplicate and favorite actions | Shared identity/owner guards; owner constraints on record queries; API authorization | Negative mocked integration tests; built server returns 401 for anonymous private APIs. |
| Auth server actions exposed account records including OAuth tokens; manual email-based account linking | Removed public lookup actions; Auth.js adapter owns account lifecycle; session queries select only necessary fields | Source inspection, successful type/build validation. Live OAuth linking/sign-in not verified. |
| Save swallowed failures and UI could mark unsaved work saved | Failed writes reject; state updated after persistence; current edits preserved during pending save | Failed-save/mutation tests preserve files and tabs. |
| Save All issued competing whole-tree writes; duplicate filenames overwritten in different folders | Single merged snapshot for Save All; full-path identity and immutable updates | Same-name and multi-file snapshot tests. |
| Duplicate project discarded saved source | Nested creation copies TemplateFile content | Mocked integration verifies saved source and owner. |
| Extensionless files mounted under undefined key | Typed recursive WebContainer transformer uses filename even with empty extension | Extensionless and dotfile regression tests. |
| File rename IDs and folder rename tabs became stale | Full-path rename IDs and prefix rewrite for open tabs; reset store between playgrounds | Typecheck; failed mutation tests. Browser interaction remains unverified. |
| WebContainer teardown captured stale state; process/listener leaks; always ran start script | Owned-instance cleanup, process/listener cleanup, listener before server spawn, dev script preferred when present | Type/build verification; actual browser preview is not verified. |
| AI requests used different models, wrong option keys, no bounds and side effects inside state updater | Shared provider and explicit request lifecycle; intended gpt-oss:20b; real num_predict/num_ctx options | Mocked provider tests and live OK response. |

Initial Prisma failures were caused by the execution network boundary: the same read-only lookup succeeded outside it. No database configuration was changed to conceal that limitation. Promise-based route params were retained according to installed Next.js 16 documentation.

## 3. Project rename

Root package.json, both lockfile name fields, page metadata and README use Vibe Code Editor / vibe-code-editor. Final old-brand search found no matching runtime/document references. No database identifiers, OAuth keys, existing resource names, environment keys, physical directory or remote repository were renamed. Existing starter package names remain independent upstream project identifiers; Git history is unchanged.

The package manager renamed package.json. An offline lock-only refresh failed on an uncached optional package, so the two lockfile name fields were synchronized directly without dependency/version changes. npm ls --depth=0 passes. A fresh npm ci was not run over the existing installation.

## 4. Architecture improvements

Added focused ownership guards, template validation, safe API error mapping, shared AI request validation/provider/parser and immutable path-based file updates. Existing feature folders remain intact. No new runtime dependencies or design system were added.

Application checks exclude standalone starter applications, which have independent frameworks/configurations. This fixes the incorrect root type/lint scope rather than suppressing application errors. Removed TypeScript suppressions and typed Monaco/WebContainer interfaces; fixed React subscription/state issues and eliminated lint warnings.

The six required starter snapshots and upstream license are now eligible for Git tracking and explicitly included in output tracing. Other local starter assets are preserved and remain ignored. Next.js generated AGENTS.md/CLAUDE.md during development; these are tooling-generated instruction files, not application behavior changes.

## 5. AI integration

Server-only OLLAMA_BASE_URL, OLLAMA_MODEL and OLLAMA_TIMEOUT_MS configure inference. Default model is gpt-oss:20b, timeout 180 seconds, num_ctx 4096, num_predict 1024, one active generation per process, ten requests/user/minute and 128 KiB request-body cap. Model presence is checked before generation. Production requires an explicit endpoint. No silent model fallback or automatic retry.

Chat supports JSON and NDJSON streaming through the existing toggle; completion preserves its JSON contract. Incremental UTF-8 parsing, final completion markers, stream error records, size bounds and cancellation are tested. Reasoning fields are not forwarded. In-stream errors cannot change HTTP status after headers and are delivered as error records.

Live Ollama tags listed gpt-oss:20b with a 13,793,441,566-byte model file. A minimal generation returned OK in 159,922 ms. This confirms connectivity/functionality, not acceptable editor latency. With the reported RAM/VRAM, memory headroom and CPU/GPU offload require measurement before multi-user use. No model installation/change occurred. Live browser streaming is NOT VERIFIED; parser/provider streaming is mocked and tested.

The preserved chat model selector does not choose arbitrary server models. Server configuration is authoritative. Durable chat autosave/multiple providers were not added.

## 6. Security

Fixed missing ownership checks, anonymous listing risk from undefined user filters, token-returning auth actions, unsafe manual account linking, shared temporary files, unbounded AI input/generation and debug logging of private records/source excerpts. Template trees reject traversal, unsafe names/prototype keys, duplicates, excessive depth/entries/size; scanner excludes symlinks and secret files. API errors expose safe messages and correlation IDs. Image optimization allowlists are limited to configured Google/GitHub avatar hosts. Environment ignore rules cover all .env variants except the placeholder example.

A targeted tracked-file scan found no private-key/GitHub-token/Google-key patterns; this is not a forensic Git-history secret audit. Output trace contains no .env files. User credentials were not printed or overwritten.

Dependency audit: FAIL — 9 affected package entries, 5 high and 4 low, representing two underlying advisories:

- High: braces stack-exhaustion DoS through nested patterns, inherited by micromatch/fast-glob/Next ESLint tooling. Registry latest braces 3.0.3 remains affected. These patterns are build-tool inputs, not a discovered public API input path. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Low: KaTeX trust restrictions can be bypassed if prototype pollution already exists. Fixed upstream starting 0.18.2; the installed math-renderer dependency ranges require a separate compatibility assessment. [Advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7).

No forced major upgrade/downgrade was applied. CI intentionally retains an audit gate; it currently fails for high development advisories. Historical starter dependency trees need separate audits before deploying generated apps.

## 7. Performance

Removed request-time filesystem writes, JSON rereads and deletes; narrowed auth/user queries; bounded inference and template resource usage; prevented duplicate completion calls and discarded stale results. Fixed lifecycle cleanup for browser processes/listeners.

Measured evidence: eight concurrent template handlers return equal output; one local minimal inference took approximately 160 seconds. No frontend bundle/runtime profiling, load test, p95 latency baseline or availability benchmark was performed. Do not interpret these changes as measured throughput/scalability gains.

## 8. Testing

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | PASS | npm run typecheck |
| ESLint | PASS | npm run lint -- --max-warnings=0; zero errors/warnings |
| Unit + mocked integration | PASS | 20 Node tests, no skipped tests |
| Original reported template defect | PASS | Real record/read-only database, old route 500, new route 200; session stubbed |
| All six template structures | PASS | Real filesystem scans |
| Local inference | PASS | Actual gpt-oss:20b generation; 159,922 ms |
| Streaming/cancellation | PASS | Mocked provider plus split UTF-8 parser tests |
| Built-server HTTP smoke checks | PASS | Eight expected responses with explicit AUTH_URL: health/sign-in/session 200, readiness/private APIs 401, dashboard redirect |
| Production build | PASS | npm run build; all routes including health generated |
| Installed dependency consistency | PASS | npm ls --depth=0 |
| Clean dependency install | NOT VERIFIED | Existing node_modules retained; no runtime dependencies added |
| Dependency audit | FAIL | 5 high / 4 low affected package entries |
| OAuth sign-in/out + full authenticated E2E | NOT VERIFIED | Browser connection failed before navigation |
| Live database CRUD mutations | NOT VERIFIED | No user data mutated during audit |
| Desktop/mobile screenshot comparisons | NOT VERIFIED | Browser tool returned missing sandboxPolicy twice |
| Static UI preservation | PASS | 25 changed TSX files had identical className/style attributes at comparison; CSS unchanged |
| Cloud deployment/inference | NOT VERIFIED | No deployment performed |

The tests use TypeScript transpilation and module mocks, not a running Next.js transport for every action. They complement type/build and HTTP checks; they do not prove all user journeys. Expected simulated failure logs in test output are not test failures.

## 9. Deployment readiness

A production smoke test initially returned UntrustedHost/500 for the session endpoint because the existing environment lacked an explicit production AUTH_URL. With AUTH_URL=http://localhost:3001 set only for the test process, all eight HTTP checks passed. Existing environment files were not changed.

Local development: starts and key backend checks pass; actual OAuth/editor journeys still need browser validation. Production build: PASS. Infrastructure: NOT VERIFIED. Actual deployment: NOT VERIFIED.

Next output tracing includes all six starter directories and excludes .env files. Public liveness and authenticated database/model readiness endpoints are available. Single-process rate limits are not distributed and do not establish high availability. Hosting topology, monitoring and release steps are in deployment.md.

## 10. Important files changed

- app/api/template/[id]/route.ts, lib/template.ts, modules/playground/lib/path-to-json.ts: root-cause path fix, authorized in-memory template loading, filesystem bounds.
- lib/playground-access.ts, dashboard/playground actions, auth.ts, auth actions: ownership, account handling, safe save/duplicate behavior.
- modules/playground/lib/validation.ts and index.ts: bounded safe trees and full-path updates.
- usePlayground/useAISuggestion/useFileExplorer hooks and playground page/editor: async lifecycle, save integrity, path identity and typed editor integration.
- modules/ai/lib/* and chat/completion routes: model config, validation, limits, streaming and cancellation.
- modules/webcontainers/*: filename conversion, instance/process/listener lifetime, correct dev startup.
- next.config.ts, routes.ts, health route, .gitignore: asset tracing, environment hygiene, headers, liveness/readiness.
- package.json/package-lock.json, app/layout.tsx, README.md: project identity and test command.
- tsconfig.json/eslint.config.mjs: independent starter scope; existing React/UI modules: lint/type fixes with retained styling.
- tests/*, .github/workflows/ci.yml, docs/*: reproducible checks and operational evidence.
- vibecode-starters/{react-ts,nextjs,express-simple,vue,hono-nodejs-starter,angular}, LICENSE: existing required assets made visible to version control; content retained.

## 11. Remaining limitations

Browser/OAuth/editor E2E and visual regression acceptance remain open. Cross-tab whole-project updates remain last-write-wins; version-based concurrency needs a reviewed schema/data transition. Binary template assets still use the legacy text schema. Historical starter packages and generated preview apps are not certified production-safe. Model latency makes the current hardware unsuitable for an unqualified interactive-performance claim. Distributed limiting, monitoring/alert delivery and restore-tested backups require deployment work.

## 12. Next steps

1. Review this diff and resolve/explicitly assess dependency advisories without forced framework downgrades.
2. On a clean checkout, configure .env.local from .env.example without overwriting existing secrets, then run npm ci, npm run typecheck, npm run lint -- --max-warnings=0, npm test, npm run build and npm start.
3. Start the existing Ollama service; verify ollama list and set OLLAMA_BASE_URL/OLLAMA_MODEL/OLLAMA_TIMEOUT_MS for the server environment.
4. Perform the staging browser/OAuth, save/reopen, all-template-preview and desktop/mobile screenshot checks listed in deployment.md.
5. Provision private inference, MongoDB access/backups, monitoring and shared limits if scaling. Obtain explicit approval before migrations or production deployment.
