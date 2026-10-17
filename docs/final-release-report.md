# Release readiness — 2026-10-17

**NOT READY for public launch.** Database connectivity and the source-size incompatibility have been addressed. Dependency advisories, production inference, real OAuth callbacks and Vercel staging acceptance remain release gates. Nothing has been committed, pushed or deployed by the agent.

## Completed changes

- Preserved the 4 MiB source contract using versioned gzip snapshots and 1 MiB transfers. Existing JSON remains readable. Saves/imports use the codec; duplication retains stored content.
- Added temporary MongoDB uploads bound to account/project, ordered chunks, one upload per account, bounded decode, abort and 15-minute expiry. A validated commit uses atomic revision comparison. Only the new SourceUpload collection's TTL index is provisioned; existing project schema/indexes are unchanged.
- Removed full source from the editor's metadata Server Action. The browser loads/saves through the authenticated chunk route.
- Added function budgets: chat/completion 300 seconds, GitHub import 120 seconds, source 60 seconds.
- Fixed invalid list markup in the sidebar empty state and added the missing mobile dashboard sidebar trigger with a navigation regression test. The supplied line-66 Sidebar JSX is valid TypeScript. Without the original error text, its exact cause remains unconfirmed. Browser checks capture hydration/nesting errors.
- Migrated React and Vue starters to Vite, upgraded Next starter dependencies and retained audited npm lockfiles in snapshots. The Next starter uses Pages Router to avoid the reproduced App Router/WebContainer incompatibility; its existing page appearance is preserved and the main editor remains App Router. Including the lock resolved an observed Angular npm installation failure.
- Added source tests, live disposable-record Mongo tests, a framework browser runner and a redacted deployment preflight.

## Evidence and limits

Typecheck, zero-warning lint and all 45 unit/controlled integration tests pass. Clean install and production build passed in an isolated Windows copy with dummy configuration; no real env files were copied. The final production build and full TEST_PREVIEW browser regression passed on October 17, including mobile sidebar navigation and the final 1 MiB transport, with no uncaught browser or captured hydration errors.

Live MongoDB ping passed outside the restricted network sandbox. The final live source test passed random 4 MiB multi-chunk round trip, stale revision, duplicate, ownership, incomplete upload, ordering, abort and cleanup checks. It bridged the real source route/browser client to MongoDB using synthetic identities, not real OAuth. All test-created records were removed; no real user project was edited/deleted. An earlier hung test was stopped and its exact synthetic records cleaned before the final successful run. The codec also passed 4 MiB NUL content whose escaped JSON exceeds MongoDB's document size.

Final full production-browser acceptance passed actual Monaco input, save/reload, project/file CRUD, Settings, synthetic GitHub/AI, completion insertion, sign-out/anonymous guards and a real WebContainer preview. Fixture providers do not certify production services.

All six framework previews now pass with the shipped lockfiles: React, Vue, Express, Hono, Angular and Next.js. The patched Next App Router exposed async-storage invariant errors in WebContainer, reproduced with Next 16.3.8 and 15.5.28. The Next 15.5.28 Pages Router starter passed in 37.6 seconds. This matches an [upstream browser-runtime issue](https://github.com/stackblitz/webcontainer-core/issues/1978); imported App Router projects may still need a regular Node runtime. Restricted-network attempts that failed before WebContainer boot are not counted as successful tests.

## Dependency gates

Registry audits show the following package findings, not independent exploit paths:

| Scope | Moderate | High | Critical |
| --- | ---: | ---: | ---: |
| Main production dependencies | 0 | 0 | 0 |
| Main full dependencies | 0 | 5 | 0 |
| React, Vue, Express, Hono, Angular starters (each) | 0 | 0 | 0 |
| Next starter | 2 | 7 | 0 |

Root findings involve the braces lint chain; Next also retains Tailwind/tooling findings. No forced incompatible fixes or disabled security gates were applied. Earlier React/Vue findings and Next's critical finding are removed. Existing saved user projects are not automatically upgraded. Remote Linux CI has not run in this session.

## Remaining release gates

1. Resolve remaining high-severity advisories without bypassing the audit gates.
2. Provision an authenticated HTTPS gateway to always-on Ollama, global admission/abuse controls and measured hardware capacity. The October 15 local probe took 80.084 seconds; it is not a production benchmark or a diagnosis.
3. Set actual AUTH_URL, OLLAMA_BASE_URL and OLLAMA_API_KEY. The checked local environment had DB/OAuth variable presence and a valid-length AUTH_SECRET, but production endpoint/gateway settings were missing. Presence does not validate OAuth credentials.
4. Configure separate staging/production databases/users and stable domains. Test both OAuth providers and reconnect identity there. User previously confirmed public GitHub import; private access still depends on repository grants. No permissions were broadened.
5. Run Linux CI and Vercel staging acceptance: near-limit saves, two-account ownership, conflicting edits, all six previews, HTTPS/cross-origin isolation, inference/cancellation, monitoring and backup restore.

## Setup and rollback

Follow the [Vercel setup guide](vercel-setup.md) and [operations runbook](deployment.md). Rollback must use a release supporting `vibecode:gzip:v1:`. Old JSON-only code cannot read new saves/imports. Code rollback does not reverse DB writes. Existing snapshots were not bulk converted.

The default remains gpt-oss:20b. The user requested faster-model advice but reserved approval for the switch. No model was installed/selected and no real environment file was edited. The setup guide describes a proposed smaller-model benchmark and switch procedure.
