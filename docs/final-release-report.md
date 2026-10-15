# Final release report - 2026-10-15

## A. UI correction

`app/(root)/page.tsx` now renders **Vibe Code With Intelligence**. Only the duplicated word was removed; classes, font, colors, spacing and component structure are unchanged. The exact heading is asserted in the production browser suite. The landing page also needed an authorization routing correction to be reachable before sign-in.

## B. Verified issues and changes

| Issue | Evidence / cause | Targeted fix | Verification |
| --- | --- | --- | --- |
| Duplicate heading word | Actual rendered h1 | Remove one word | Exact browser heading assertion |
| Anonymous landing page inaccessible | Production GET / returned 302 to sign-in; root absent from public routes | Make only / public; protected destinations keep existing guards | Anonymous landing/Get Started browser acceptance |
| Intermittent Tab completion failure | Browser showed accept hint but Tab inserted indentation; handler ref updated in passive effect after render | Update committed handler state with useLayoutEffect before paint | Two complete repeated production browser runs passed after correction, followed by a passing full final routing run |
| Secure remote inference authentication unsupported | Both Ollama calls sent no credential | Optional server-only OLLAMA_API_KEY, HTTPS requirement, reject redirects for discovery/generation | New provider test; legacy local calls still pass |
| Shipped starter advisories absent from CI gate | Root npm audit does not inspect nested lockfiles | Separate always-run audit step for all six shipped starters, aggregate nonzero exit | All six audit commands executed; known findings remain failing gates |

No dependency versions, schema, real environment files or user project data changed. Previous preview/save/GitHub fixes were preserved and exercised. No commits, pushes, merges or deployments were performed.

## C. Critical journey acceptance

PASS below means the stated test scope only. Browser tests use the actual production Next server, Auth.js encrypted synthetic session, Server Actions and Monaco; database, GitHub and AI responses are isolated fixtures. This is not real OAuth or MongoDB persistence certification.

| # | Journey | Result and scope |
| --- | --- | --- |
| 1 | Open homepage | PASS production browser; anonymous routing covered |
| 2 | Exact heading | PASS exact accessible h1 assertion |
| 3 | Sign in | NOT VERIFIED real GitHub/Google provider round trips; sign-in destination/session guards tested |
| 4 | Dashboard | PASS synthetic authenticated user |
| 5 | Create project | PASS isolated record |
| 6 | Open playground | PASS actual Monaco UI |
| 7 | Edit code | PASS real editor input |
| 8 | Save / Save All | PASS Server Action + fixture persistence |
| 9 | Reload | PASS browser reload |
| 10 | Saved changes remain | PASS fixture-backed reload/reopen; NOT VERIFIED real DB durability |
| 11 | Duplicate | PASS isolated copy retains saved source |
| 12 | Delete dedicated test project | PASS cancellation, confirmation and reload; no real project deleted |
| 13 | Settings | PASS desktop/mobile |
| 14 | Save preference | PASS profile fixture and real per-account browser editor/model preferences across reload |
| 15 | Authorized GitHub import | PASS fixture list/import; user previously confirmed real public import. NOT VERIFIED current private import |
| 16 | Open imported project | PASS fixture snapshot with real editor |
| 17 | Run preview | PASS real browser WebContainer Node server, iframe reload/restart, shell quoting; NOT VERIFIED all six framework installs |
| 18 | AI chat | PASS fixture streaming, selected installed model and Stop; local real Ollama stream succeeds but production end-to-end NOT VERIFIED |
| 19 | Code completion | PASS provider fixture through actual editor and Tab insertion; real interactive latency FAIL for release expectations |
| 20 | Sign out | PASS actual Auth.js sign-out of synthetic session and subsequent protected endpoint rejection |

Additional PASS: rename/favorite, file/folder create/rename/delete, unsaved close cancellation, multi-file saves, source revision conflict/ownership tests, model unavailable/error handling, source sync preserving dependencies, preview unsaved-buffer restart without implicit persistence, retained terminal logs on startup failure, no uncaught browser errors in successful full runs. API tests cover malformed/oversized/cross-origin/anonymous requests, GitHub token refresh identity pinning, revoked-token public fallback, rate/permission distinctions, traversal/symlink exclusions and sanitized failures.

Real-service limitations: local read-only MongoDB ping failed with PrismaClientInitializationError after 15,058 ms; no credential/error URL was logged. Real CRUD was not attempted on existing data. Real Google login, private repo grants, deployed callbacks, TLS gateway, Linux hosting and production backup restore remain NOT VERIFIED.

## D. Build and quality evidence

Installed: Node 24.15.0, npm 12.0.2, Next 16.3.8, React/React DOM 19.3.0, TypeScript 6.0.3, next-auth 5.0.0-beta.32, Prisma/client 6.19.3, Monaco 0.57.0, WebContainer 1.6.4, Playwright 1.64.0. `npm ls --depth=0` succeeded.

- TypeScript: PASS `npm run typecheck`.
- ESLint: PASS `npm run lint -- --max-warnings=0`.
- Unit/integration: PASS 41/41 `npm test` (controlled dependency/route/action fixtures; not live database tests).
- Clean install: PASS `npm ci` in a new temporary copy of tracked files including current edits, excluding all .env files; dummy database/secret. Installed 666 packages. npm 12 reported blocked third-party install scripts; the app's explicit Monaco preparation and Prisma generation both completed, and the build passed. This Windows check does not substitute for Linux CI.
- Full `npm run build`: PASS isolated clean copy, including Prisma generation, compile and type checking. Original workspace build failed on a Prisma DLL lock held by existing runtime use; no user process was killed.
- Production browser: initial run exposed completion timing failure; corrected and two full reruns passed including real WebContainer, zero uncaught errors. The final full run also passed anonymous homepage/Get Started and sign-out assertions, with zero uncaught errors. An intermediate run caught the old sign-out URL expectation; it was corrected to the existing configured / destination while retaining anonymous API/session protection checks.
- Visual review: desktop preview/terminal and 390px Settings screenshots reviewed; no layout/style redesign. Mobile Settings overflow assertion passes. Full mobile editor ergonomics/accessibility and pixel-diff baselines are NOT VERIFIED.
- Anonymous production smoke without database/provider fixtures: liveness 200, session 200, protected dashboard redirects, authenticated readiness 401, COOP/COEP present. Final anonymous / returns 200 with the exact heading (216 ms); sign-in returns 200 (26 ms); protected Settings and dashboard redirect (5-6 ms). Other smoke responses took 9-20 ms. These localhost timings are not production load benchmarks.
- Trace estimate: largest traced route 85,221,069 bytes; template 84,893,833 bytes with 52 starter files, no missing files. Linux/Vercel packaging still requires verification.

Fresh dependency audit (registry access, no forced changes):

| Lockfile | Low | Moderate | High | Critical | Gate |
| --- | ---: | ---: | ---: | ---: | --- |
| App production dependencies | 0 | 0 | 0 | 0 | PASS |
| App full dependencies | 0 | 0 | 5 | 0 | FAIL |
| React starter | 3 | 35 | 62 | 0 | FAIL |
| Next starter | 0 | 2 | 11 | 1 | FAIL |
| Vue starter | 0 | 19 | 14 | 0 | FAIL |
| Express starter | 0 | 0 | 0 | 0 | PASS |
| Hono starter | 0 | 0 | 0 | 0 | PASS |
| Angular starter | 0 | 0 | 0 | 0 | PASS |

Counts are npm package findings, not independent exploitable paths. Raw audit JSON and screenshots are in ignored `test-results/`. The GitHub Actions workflow itself has not run remotely in this session.

## E. Security assessment

Owner checks cover project actions and template loading; writes repeat ownership in database predicates. Saved revisions use atomic observed-content comparison. Auth.js handles OAuth/session protections; application JSON writes enforce same-origin when Origin is supplied and validate bounded input. No host execution of imported/generated code was introduced. GitHub requests use a fixed API origin, pinned commit, bounded reads and filtered paths. Prompt context is marked untrusted, but prompts are not a security boundary: users must review generated code, which runs only in their browser preview.

The five root high findings originate in braces stack-exhaustion via the lint glob dependency chain. Registry latest remains 3.0.3, still affected; npm suggests a framework-tooling major downgrade. No unsafe override/downgrade applied. Runtime production audit is clean, but CI handles potentially untrusted source and the full audit gate still fails. [Braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

The old Next starter includes critical Windows-hosted and AVIF image-optimization RCE advisories. Those conditions do not establish exploitability of every browser sandbox, but shipping vulnerable starter applications that users may deploy remains unacceptable for public release. React/Vue findings also require reviewed dependency migrations and runtime testing. Prior safe same-major fixes are already applied; remaining remediation is not a small lockfile-only patch. No silent major migration was performed. [Windows advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36), [image optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).

Other remaining risks: process-local admission/rate limits do not constrain a multi-instance deployment globally; gateway authentication must actually be configured; tokens are sensitive server-side DB fields and need restricted/secured storage and backups; imported binary files are unsupported; max raw source size does not bound encoded transport or document size. No claim of zero critical defects or complete penetration testing is made.

## F. Deployment architecture

Vercel Node 24 + managed MongoDB replica set + authenticated HTTPS gateway to private Ollama is conditionally suitable. Browser WebContainers need HTTPS/cross-origin isolation. Full current project-size support is not yet compatible with Vercel payload limits; either agree and implement a bounded encoded/chunked persistence contract or choose a managed Node host and resolve its own configured body/document bounds. The [deployment runbook](deployment.md) covers evidence, limits, domains, callbacks, inference, CI, health, monitoring, backups and rollback. No platform migration or deployment occurred.

Actual local Ollama discovery: 200 in 74 ms; installed gpt-oss:20b file 13,793,441,566 bytes. A 64-token-budget trivial streamed probe (4096 context, low thinking) completed with two response characters after 80,084 ms; first response token at 79,653 ms. This run occurred on the development machine alongside release work, so it is not an isolated capacity benchmark. Production GPU memory, sustained concurrency and interactive latency are unproven. Keep the model/provider unchanged; provision and measure appropriate private inference infrastructure.

## G. Production environment names

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`; optional `OLLAMA_ALLOWED_MODELS` and gateway `OLLAMA_API_KEY`. Hosting sets `NODE_ENV`. Separate staging/production credentials and databases; no secrets are included here. `.env.example` documents only the new optional gateway credential.

## H. Release blockers and exact next actions

1. Approve a focused migration of the vulnerable React/Next/Vue starter dependencies, validate every starter runtime, and resolve the braces advisory when a compatible patch is available. Keep current audit failures visible.
2. Restore database connectivity and provision a separate staging replica set/database. Run real two-account ownership, create/save/reopen/duplicate/delete and concurrent save tests using dedicated disposable records.
3. Choose the hosting/source-size contract. Test worst-case escaped payloads and persisted MongoDB document sizes before Vercel approval; no data truncation.
4. Provision an authenticated reachable Ollama gateway with the same installed model, global rate/admission controls and measured latency/memory. Current hardware response time is unsuitable for completion UX.
5. Choose stable staging/production domains, configure exact Google/GitHub callbacks and secret scopes, and complete real provider acceptance. Decide private repository consent/grant support if it is a launch promise; default login cannot establish it.
6. Run Linux CI and all six framework previews, then perform the 20 listed journeys on the real staging deployment. Verify monitoring/alerts, backup restore, rollback and near-limit source handling. No production action is authorized yet.

These external/configuration/migration decisions prevent declaring release readiness; code fixtures cannot replace them.

## I. Modified files

- `app/(root)/page.tsx`: exact heading typo only.
- `routes.ts`: public landing page; protected-route inventory consistent with private destinations.
- `modules/playground/components/playground-editor.tsx`: synchronize keyboard-handler state before paint.
- `modules/ai/lib/ollama.ts`: optional TLS bearer gateway authentication and redirect rejection.
- `.env.example`: document optional server-only gateway key.
- `tests/ai.test.mjs`: credential/TLS/discovery/generation regression.
- `tests/browser/run.mjs`: exact heading, anonymous routing acceptance and gateway-key fixture isolation.
- `.github/workflows/ci.yml`: audit all shipped starter lockfiles without disabling failures.
- `docs/deployment.md`: repository-specific deployment/rollback runbook and limits.
- `docs/final-release-report.md`: this scoped verification evidence and blockers.
- `docs/engineering-progress.md`: resumable release checkpoint.

## J. Verdict

**NOT READY** for professional public launch. The targeted application fixes and isolated build/browser checks are successful, but known high/critical starter advisories, transport limits and unverified/unavailable production services remain. Production is not deployed or verified. Work stayed on `feature/production-readiness`; the initially clean branch now contains reviewable uncommitted changes only.
