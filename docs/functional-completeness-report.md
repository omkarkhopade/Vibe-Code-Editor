> Follow-up: the user has now confirmed real GitHub import works. Preview now uses live unsaved buffers, preserves terminal logs on startup failure, and has passing browser regressions for both. Tests: 40/40. See the latest engineering-progress.md checkpoint for the project-camp-api diagnosis. Earlier pending-GitHub statements below describe the previous checkpoint.

# Functional completeness verification — 2026-10-14

**Release classification: NOT READY.** Core journeys now have passing browser evidence, but the Next.js starter retains a critical advisory, development-tool advisories remain, and real OAuth/account acceptance and deployment infrastructure have not been verified. This report supersedes the verification tables and open-item lists in the earlier engineering report; those remain historical checkpoints.

Work stayed on `feature/production-readiness`. Existing user commits were preserved. No agent commits, pushes, deployments, migrations, model downloads or real database mutations were performed. Browser CRUD uses an isolated in-memory database and synthetic identity. The user will test actual GitHub reconnect after this work is delivered.

## Critical issue fixes

| Issue | Root cause and completed fix | Evidence |
| --- | --- | --- |
| Settings returned 404 | Navigation targeted a missing route. Added authenticated `/settings`, real profile-name persistence, linked-provider display, GitHub connection/reconnect, installed-model selection and browser-local editor preferences. | Browser profile save/reload, preferences/reload, connection display and mobile layout pass; authorization/validation tests pass. |
| Delete Project difficult to find/unreliable | Backend deletion already existed; confirmation closed before asynchronous completion. Reused it, labeled the project action menu, retained the confirmation until success, blocked duplicate submissions and refreshed the dashboard. | Browser duplicate → cancel deletion → confirm deletion → reload passes. Unit tests reject foreign ownership and simulated database failures. Actual MongoDB cascade mutation remains untested. |
| GitHub always expired | A valid app session did not imply a valid GitHub credential. The stored account had expired metadata and GitHub returned 401. Auth.js's existing-account login path did not replace saved OAuth credentials. | Read-only live diagnostic: one account, one expired metadata value, one GitHub 401, no private-repository scope. |
| Reconnect did not repair stored token | Added post-authentication credential persistence pinned to the verified user, provider and provider identity. No email-based auto-linking or client-supplied ownership. | Unit tests verify identity predicates and credential non-disclosure. Actual OAuth reconnect is pending the user's test. |
| GitHub import blocked public repositories with revoked credentials | Retry public reads anonymously after 401; distinguish missing connection, revoked access, permissions, not found and rate limit errors. Added connection status and paginated repository selection. | Browser list/select/import/open passes with GitHub/DB fixtures; live public read-only snapshot import previously passed (seven files). No real private import or real database write claimed. |
| Monaco loading and completion errors | CDN version differed from installed Monaco. Serve installed assets locally. Use one completion provider per editor, current callbacks, per-file model paths and the installed disposal API. | Actual Monaco edit/save/reopen and Tab insertion pass. |
| Intermittent Monaco `Canceled` error | Installed 0.57.0 accessibility-announcement callback awaited cancellation without handling it. `prepare:editor` patches only those two awaits in copied browser assets, ignores only `Canceled`, and rethrows other errors. | Expanded browser run passes with strict uncaught-error assertion. Preparation fails if version/content changes, requiring review of the workaround. No global error suppression. |
| Terminal broke quoted commands | It split input on spaces and emulated a shell in React. Replaced this with WebContainer's `jsh`, connecting input/output, resizing and cleanup. | Real browser-runtime quoted Node command and downloaded output pass. Host never executes playground code. |

## Interaction inventory

“Browser PASS” means a real Chrome browser against the production Next.js build. Identity, database, GitHub and Ollama are fixtures unless a row explicitly says **live**. “Reviewed” means implementation inspected, not a completed end-to-end check. These distinctions matter for release acceptance.

| Area / visible interaction | Implementation and verification |
| --- | --- |
| Home logo, dashboard entry | Existing routes; reviewed. |
| Desktop/mobile Docs and API | Point to `/docs` and `/docs#api`; fixed mobile `/pricing` destination. Public guide exists. |
| Footer GitHub icon | Opens actual GitHub import guide; reviewed. |
| Theme toggle | Existing light/dark theme retained; now a labeled keyboard-operable button using the resolved system theme. Browser PASS. |
| Account menu, email, logout | Existing session menu; labeled trigger. Settings sign-out and resulting anonymous endpoint rejection: Browser PASS. Header-menu logout separately reviewed. |
| Google/GitHub sign-in | Existing Auth.js provider flows preserved; callback persistence repaired. External OAuth browser acceptance: NOT VERIFIED. Removed nonfunctional `#` legal links rather than presenting nonexistent policies as agreements. |
| Sidebar Home/Dashboard/Settings | Valid routes. Dashboard → Settings → dashboard: Browser PASS. |
| Sidebar recent/favorite project links, View all | Owned project destinations and `/dashboard`; reviewed. |
| Sidebar create/manage favorites shortcuts | Create opens dashboard creation flow; favorite shortcut opens dashboard management. Reviewed. |
| Create project: template, Continue, Back, name, description, Cancel | Async submission preserves input on failure and prevents duplicates. React-template creation/opening: Browser PASS; other template selections structurally tested, runtime not all verified. |
| Open project / open in new tab | Existing owned route. Same-tab opening: Browser PASS; new-tab variant reviewed. |
| Rename project / cancel / save | Browser PASS for saving and reload-visible identity; failure handling reviewed. |
| Duplicate project | Copies persisted source under authenticated owner. Browser PASS; unit tests verify ownership/content. |
| Favorite/unfavorite | Browser PASS across reload. |
| Copy project URL | Awaits clipboard and reports failure; reviewed, clipboard permission cases not browser-tested. |
| Delete Project / cancel / confirm | Browser PASS with reload; ownership/failure unit tests. |
| Import repository URL / branch / submit / cancel | Pinned, bounded Node.js snapshot import; failure retains form. Browser PASS for fixture URL/ref import and opening. Parser/security unit tests pass. |
| Browse repositories / select / previous / next | Browser PASS for list/select; pagination implementation reviewed, multi-page live account not verified. |
| Manage/reconnect GitHub link | `/settings`; reviewed. |
| Settings profile name / Save profile | Actual server action and session refresh. Browser PASS with fixture database; invalid/anonymous writes tested. |
| Settings email / linked providers | Read-only account data; Browser PASS. |
| Settings GitHub status / refresh | Distinguishes connection states without returning credentials. Browser PASS for fixture connection; unit tests cover revoked/missing/rate-limited. |
| Settings Connect / reconnect | Signed-in Auth.js flow to Settings; user's real-account acceptance PENDING. No unsafe provider unlink/account deletion added. |
| Settings model catalog / refresh / selection | Installed Ollama only; preferred chat model saved per account in this browser. Browser PASS and allowlist tests. |
| Settings font size / tab size / word wrap | Persisted local preferences applied to Monaco options. Browser preference persistence PASS; changing default chat selection restores server default. |
| File explorer expand/collapse / select | Full-path identity, including same-named files. Browser selection PASS; nested path unit tests. |
| New file / extension / Cancel / Create | Browser PASS, including invalid path retaining form/error. Extensionless conversion unit-tested. |
| New folder / nested creation | Root creation: Browser PASS; nested handlers reviewed and path validation tested. |
| File/folder rename / delete / confirmation | Browser PASS. Rejected operations retain tabs/source and dialogs; unit tests. |
| Editor typing / tab switch / undo isolation | Real Monaco typing and file switching: Browser PASS. Unique model paths preserve per-file model identity. Undo/redo combinations separately unverified. |
| Save / Ctrl-Cmd+S | Button path: Browser PASS through reload/reopen. Keyboard handler reviewed. Failed writes reject and retain unsaved content. |
| Save All / Ctrl-Cmd+Shift+S | Two edited files persisted through reload: Browser PASS. One combined snapshot and stale-save rejection unit tests. Keyboard variant reviewed. |
| Close tab / Close All | Browser PASS for canceling an unsaved tab close. Shared confirmation logic reviewed for close all; reload guard implemented. |
| Editor actions → dashboard / Settings | Warn before discarding unsaved changes; reviewed. |
| Hide/show preview / resize panes | Existing controls retained; reviewed. |
| AI enable/disable | Cancels pending completion and clears state; handlers now use current props. Reviewed; toggle timing not separately browser-tested. |
| Completion Ctrl-Cmd+Space / Tab / Escape | Request and insertion: Browser PASS. Cursor/version checks reject stale results; errors now visible. Escape/rejection reviewed. |
| Open/close AI chat / keyboard focus | Browser PASS for open/close. Accessible dialog, inert closed panel, focus restoration and Escape/Tab handling implemented. Full assistive-technology audit not performed. |
| Chat model / refresh | Browser PASS; selected installed model reaches request. Live machine has only `gpt-oss:20b`; second-model behavior uses fixture catalog. |
| Chat input / Send / streaming | Browser PASS. Unit tests cover framing, split UTF-8, malformed/empty/upstream failures. |
| Stop response | Browser PASS: partial output stops and input is enabled again. Upstream cancellation/unit admission tests pass. |
| Chat/review/fix/optimize tabs / Include active source | Modes and optional bounded source context wired to requests; reviewed. No automatic file application is claimed. |
| Stream responses checkbox | Chooses JSON versus streaming; server paths unit-tested, browser covers streaming. |
| Search/filter messages / suggested prompts | Local filters and input actions implemented; reviewed, not individually browser-tested. |
| Copy/reuse message | Clipboard feedback and input reuse implemented; reviewed. |
| Export/Clear chat | Local JSON download and conversation clear; reviewed. No durable chat autosave is advertised. |
| Preview initialize / dependency install / server start | **Live WebContainer Browser PASS** for a synthetic dependency-free Node HTTP project. Real runtime and npm execution, not a mocked iframe. |
| Preview Reload / Restart server | **Live Browser PASS** including visible served response. |
| Preview failures / Retry | Boot/install/server timeouts, process-exit errors and retry controls implemented. Restricted network reproduced StackBlitz access denial; permitted run passed. |
| Preview source sync / rename / delete | Synchronizes saved source and removes obsolete source paths without deleting dependencies; unit-tested. All-framework live reload not verified. |
| Terminal command input / quoted arguments | **Live Browser PASS** using `node -e` with quoted code, verified through downloaded terminal output. |
| Terminal search / clear / download | **Live Browser PASS** for controls and downloaded output. |
| Terminal selection copy / history / Ctrl+C / cd / pipes | Real shell supports these; clipboard feedback added. Individual browser acceptance not completed. |

## Quality and security evidence

| Check | Result |
| --- | --- |
| Node tests | **39/39 PASS**, no skipped tests; unit/mocked integration scope. |
| TypeScript | PASS (`npm.cmd run typecheck`). |
| ESLint | PASS with zero warnings (`npm.cmd run lint -- --max-warnings=0`). |
| Production compile | PASS (`npm.cmd run build`), including local Monaco preparation, Prisma Client generation, compilation, types and route generation. Earlier Windows DLL-lock failures no longer reproduce; no user server was killed. |
| Production browser journeys | PASS with strict zero-uncaught-error check, including Save All, invalid filename feedback, chat stop and real preview/terminal. |
| Visual checks | Settings desktop/mobile and editor desktop screenshots generated; mobile Settings fits 390px without horizontal overflow. Broader mobile editor/assistive-technology acceptance remains open. |
| Main production dependency audit | **0 vulnerabilities** after tested KaTeX update. |
| Main full dependency audit | **5 high**, development lint chain. CI deliberately retains the failing audit gate. |
| Real MongoDB | Prior reported template read-only reproduction/fix passed. CRUD mutations/cascade behavior on live database NOT VERIFIED. |
| Real AI | Installed catalog passed; earlier minimal `gpt-oss:20b` generation took 159,922 ms. Interactive performance remains a limitation. |
| Real GitHub | Public read-only snapshot passed. Stored token diagnosed as expired/rejected. User reconnect and private authorization NOT VERIFIED. |
| Clean install / deployed environment | NOT VERIFIED. No deployment performed. |

Ownership comes from the authenticated server session, not request user IDs. Source trees reject traversal, prototype keys, duplicates and excessive depth/size. Save revisions compare the observed persisted content atomically and reject stale saves without a schema migration. OAuth tokens remain server-side. GitHub API requests use a fixed host, commit pinning, bounded downloads and excluded sensitive filenames; filename filters do not guarantee that arbitrary source contains no secrets. AI content stays untrusted data, Markdown does not enable raw HTML, and KaTeX compatibility/security tests pass. Admission/rate limits remain per process.

### Starter dependency audit

Registry audit results on 2026-10-14, counting affected package entries, not distinct CVEs. Lockfiles were updated without executing starter lifecycle scripts on the host.

| Starter | Before this dependency pass | After | Disposition |
| --- | --- | --- | --- |
| React / CRA | 106 (4 critical) | 100: 3 low, 35 moderate, 62 high | Legacy `react-scripts` chain needs a reviewed tooling migration. Rejected audit's incompatible `react-scripts@0.0.0` suggestion. |
| Next.js | 25 (1 critical) | 14: 2 moderate, 11 high, 1 critical | Same-major patches applied. Remaining Next 13 advisories require a supported-major migration and runtime compatibility verification. |
| Express | 5 (1 critical) | 0 | Compatible lockfile fixes. |
| Vue | 56 (3 critical) | 33: 19 moderate, 14 high | Compatible fixes applied; legacy Vue CLI tooling remains. |
| Hono | 2 high | 0 | Same-major Hono and Node adapter updates. |
| Angular | 43 (3 critical) | 0 | Updated lockfile within existing Angular 21 version ranges. |

These are shipped source templates, not all root runtime dependencies. New project previews install them, so they still matter. Existing saved projects retain their own snapshots and are not silently rewritten by starter updates. All six full framework builds/previews have not been rerun; a clean audit alone does not establish runtime compatibility. No forced major migration was used to make counts look clean.

## Exact remaining acceptance work

1. On the updated running app, open Settings → **Connect / reconnect GitHub**, use the same identity, then **Refresh GitHub status**. Confirm the displayed login. In Dashboard → Open GitHub repository, browse and import a disposable public Node repository. Private import requires an already-authorized token; the app does not request broad write-enabled `repo` scope.
2. Use a disposable staging account/database for actual project create, profile save, edit/Save All/reopen, duplicate and delete/cascade verification. Test Google and GitHub sign-in/out and ownership with two accounts. Do not use valuable projects for destructive acceptance tests.
3. Reproduce local checks with Node 24 and Chrome installed:

   ```powershell
   npm.cmd run typecheck
   npm.cmd run lint -- --max-warnings=0
   npm.cmd test
   npm.cmd run build
   npm.cmd run test:browser
   $env:TEST_PREVIEW='1'
   npm.cmd run test:browser
   Remove-Item Env:TEST_PREVIEW
   npm.cmd audit --omit=dev
   npm.cmd audit
   ```

   `test:browser` uses port 3107 and an isolated synthetic database; it never uses your actual OAuth identity. The optional preview run requires StackBlitz/npm access and browser WebContainer support. If Windows prevents Prisma regeneration, stop your own app server first, then rerun the normal build. A direct Next build only verifies compilation with the already-generated client.
4. Review and migrate remaining vulnerable React/Vue/Next starter tooling, then run all six template install/build/preview journeys. Keep the full audit gate enabled. Complete a clean `npm ci` and full check sequence in a separate clean checkout.
5. Confirm production `AUTH_URL`, provider callback URLs, secrets, private Ollama connectivity/latency, MongoDB replica-set/TLS/backups, streaming time limits and monitoring. Publish operator-approved terms/privacy information if required for the intended deployment. Infrastructure changes and deployment still require explicit approval.

Optional read-only credential diagnosis: `node tests/diagnose-github.mjs`. It emits aggregate status counts only; never paste credentials, database URLs or OAuth callback URLs into reports.
