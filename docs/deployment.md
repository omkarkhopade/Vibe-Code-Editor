# Deployment and operations

Release assessment: 2026-10-17. Start with the [step-by-step Vercel setup](vercel-setup.md). **NOT READY for public launch.** See [final release report](final-release-report.md). No deployment has been performed. Resolve its gates before following the activation steps below.

## Hosting decision

Preferred conditional topology: browser (Monaco and WebContainer) -> Next.js on Vercel Node.js 24 -> managed MongoDB replica set; Next.js -> authenticated HTTPS inference gateway -> private Ollama with installed `gpt-oss:20b`. The browser never receives gateway credentials or database/OAuth secrets. Vercel cannot reach the developer workstation through localhost and must not host the model in a function.

Vercel supports Node.js 24. Use the Next.js preset, repository root, `npm ci`, and `npm run build`; no static export. Node routes use Prisma's generated native client. Do not select Edge for database/template routes. Build on the deployment OS, never upload the Windows-generated Prisma engine. [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

**Chunked source persistence implemented:** the 4 MiB raw-source contract is preserved using gzip/base64 snapshots and 1 MiB request/response chunks. Legacy JSON remains readable. Temporary uploads are bound to the account/project, ordered, limited to one per account, and expire after 15 minutes. A validated commit uses atomic revision comparison. Live MongoDB tests passed near-limit transfer and conflict/ownership checks. Verify these paths again on Vercel before launch. The new SourceUpload collection requires its TTL index; application expiry checks do not rely on immediate TTL cleanup.

Fluid Compute's documented 300-second default accommodates the app's default 180-second inference timeout, but operators must verify actual project settings. Keep timeout below hosting/gateway limits with margin; setting `OLLAMA_TIMEOUT_MS=600000` on a 300-second function is invalid operationally. Streaming counts toward duration. The normal uncompressed function ceiling is 250 MB; the October 15 Windows trace estimate was about 85.2 MB maximum, before the starter migrations and lockfile inclusion. These are estimates, not a Vercel/Linux deployment artifact certification. [Vercel function limits](https://vercel.com/docs/functions/limitations).

## Environment inventory

Set values in hosting secret storage. Never copy local `.env` files into source control, browser code, build artifacts or diagnostics. None of these variables uses `NEXT_PUBLIC_`.

| Name | Local | Staging / production |
| --- | --- | --- |
| `DATABASE_URL` | Development replica set | Separate TLS MongoDB database and least-privilege user per environment |
| `AUTH_SECRET` | Local random secret | Independent high-entropy secret per environment; keep stable across replicas |
| `AUTH_URL` | `http://localhost:3000` | Exact canonical HTTPS origin |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Local OAuth application | Separate registered application credentials for stable staging / production origins |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Local OAuth client | Separate staging / production OAuth credentials |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Private reachable endpoint or authenticated HTTPS gateway URL |
| `OLLAMA_API_KEY` | Omit for local Ollama | Server-only bearer secret validated by the HTTPS gateway |
| `OLLAMA_MODEL` | `gpt-oss:20b` | Same installed model; no automatic substitution |
| `OLLAMA_ALLOWED_MODELS` | Optional installed-model list | Explicit comma-separated installed models permitted for users; blank permits all installed models |
| `OLLAMA_TIMEOUT_MS` | `180000` default | Match verified gateway and function budget; parser accepts 1000..600000 ms |
| `NODE_ENV` | Managed by Next development | Production, normally managed by host |

`TEST_PREVIEW` and `PLAYWRIGHT_CHANNEL` are test-only. Never install the synthetic browser fixture as a production preload. CI uses dummy `DATABASE_URL` and `AUTH_SECRET` and requires no production credentials. Build downloads Google Fonts and npm dependencies. Normal install/prebuild generates Prisma and copies the installed Monaco assets and license to `public/monaco`. Its narrowly guarded Monaco 0.57.0 workaround fails on incompatible upgrades; review it before changing Monaco.

## Database and authentication

Provision a replica set with TLS, restricted network access, a dedicated application database/user, connection limits and backups. Configure supported MongoDB driver connection/server-selection timeouts and pool sizes for expected concurrency; do not apply PostgreSQL pooling parameters. Prisma's MongoDB connector uses the MongoDB driver pool. Keep the singleton client; function instances still have separate pools. [Prisma v6 pool documentation](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool).

No migrations, resets or schema pushes are part of deployment here. Review the existing schema's unique/index requirements separately with a backup and explicit approval. Verify nested create/duplicate and source compare-and-swap against an isolated real staging replica set before release. Read-only MongoDB ping and disposable-record live source/CRUD tests passed on October 16. The test records were removed. This does not establish production network access, backup restore or capacity.

Choose `https://staging.example.com` and the final production origin before registering OAuth. Replace example domains with the actual chosen origins:

- GitHub homepage: the origin; callback: `https://<origin-host>/api/auth/callback/github`.
- Google authorized JavaScript origin: the origin; exact redirect URI: `https://<origin-host>/api/auth/callback/google`. Configure consent/publishing and test users appropriately.
- Set `AUTH_URL` to that same origin. Use a stable staging domain instead of arbitrary per-PR callbacks.
- Do not add blanket trusted-host settings. The reverse proxy must reject unknown hosts and overwrite forwarded host/protocol headers. Vercel's recognized environment is supported by Auth.js; verify `/api/auth/session` and real provider round trips on the target domain. [Auth.js deployment](https://authjs.dev/getting-started/deployment).
- Test sign-in, refresh, sign-out and cross-account ownership. Do not enable automatic email-based linking. Verify Settings shows the expected GitHub identity after reconnect. Tokens stay in server-side account storage; restrict DB access and backups accordingly.
- Private repository import only works if the stored GitHub credential already has the required repository/organization grant. Current default OAuth login does not request broad `repo` scope. If private import is a release requirement, agree on a consent/access design and verify it with a dedicated private test repository. Do not silently broaden permissions.

## Inference service

Keep Ollama bound to loopback/private networking. For cross-network access, use TLS and a gateway that verifies `OLLAMA_API_KEY`, allows only required `/api/tags` and `/api/generate` operations, enforces body limits, controls concurrent work, and forwards cancellation. Block public access to port 11434 and model-management endpoints. Disable proxy response buffering, use suitable upstream timeouts, and do not log prompts, source or authorization headers. The app rejects redirects and refuses sending its bearer key over HTTP. An optional key in the app does not secure an unconfigured gateway. [Ollama network and concurrency configuration](https://docs.ollama.com/faq).

The installed model file is 13,793,441,566 bytes, consistent with the approximately 14 GB published artifact. Runtime memory additionally needs KV cache, compute buffers, OS and application headroom. The development machine's approximately 14 GB RAM / 2 GB VRAM is not demonstrated production capacity. Select hardware only after a staging benchmark with the current 4096-token context and 1024-token output cap; record cold/warm first-token latency, total latency, peak RAM/VRAM and queue depth. [Ollama model catalog](https://ollama.com/library/gpt-oss).

The October 15 pass measured a trivial local streamed response at 80.084 seconds, first response token at 79.653 seconds. That proves connectivity, not acceptable completion latency or concurrency. Admission and 10/user/min rate limits are process-local; Vercel replicas need shared abuse controls and global inference concurrency limits. Initially serialize work at the gateway with a bounded queue/rejection response and measure capacity before raising it. No GPU service or gateway has been provisioned.

## Browser isolation and assets

Preserve COOP `same-origin`, COEP `require-corp`, `X-Content-Type-Options: nosniff`, and the current referrer policy on routes. Serve HTTPS and verify `crossOriginIsolated` in the target browser after any CDN/proxy changes. WebContainers run user code in the browser, never on the Next server. Their service-worker/network and browser compatibility requirements still apply. [WebContainer headers](https://webcontainers.io/guides/configuring-headers), [browser support](https://webcontainers.io/guides/browser-support).

Deploy all six starter snapshots and their licenses; `outputFileTracingIncludes` covers the template route. All six shipped framework previews have passed. The Next starter uses Pages Router because the patched App Router versions reproduced async-storage failures inside WebContainer. This limitation may also affect imported App Router projects; it does not change the editor application router. Native-addon backends such as the user's project-camp-api need a normal Node environment and their own configured database/secrets; a browser preview cannot certify arbitrary repositories. Binary assets are excluded by the current text-only import contract.

## Release, monitoring and rollback

1. Resolve the security, real-service and acceptance blockers in the release report. CI must pass: install, typecheck, zero-warning lint, tests, build, fixture browser tests, root and six starter audits. Do not bypass the currently failing security gates.
2. Obtain explicit deployment authorization. Configure an isolated staging database, provider applications, inference gateway, stable domain and secret scopes. Keep production secrets out of preview deployments.
3. Build a reviewed revision on Linux/Node 24. Record commit, lockfile, build identity, environment-version references and rollback candidate. Verify asset traces and platform limits there.
4. Configure domain/DNS using the host-provided records; verify TLS issuance and canonical redirect, then callback URLs. Do not point public traffic to an unverified deployment.
5. Run the acceptance journeys in the release report with dedicated staging data. Include another account attempting unauthorized access, conflicting saves, near-limit source payloads, private repository access if promised, real inference cancellation, missing model, and each supported framework preview. Verify mobile layout and browser console errors.
6. Monitor unauthenticated `/api/health` for liveness. Authenticated `/api/health?ready=1` checks database and model availability; a successful response is not an inference performance test. Protect monitoring session credentials. Alert on sanitized request IDs/types, 5xx/429, save failures, database pool/connect latency, inference timeouts, queue depth and GPU/RAM pressure. No external monitoring is currently provisioned.
7. Enable encrypted MongoDB backups with an owner, retention policy and recovery targets. Test restore into a separate database and verify account/project counts and sample sources. Never restore over production as an experiment. Back up deployment configuration and gateway configuration without putting secrets in Git.
8. After staging approval, obtain production deployment approval, promote the tested artifact, rerun acceptance and observe latency/error rates before increasing traffic. No production verification is claimed in this repository.
9. Rollback on failed auth, ownership, save/persistence, unavailable inference or elevated errors: stop promotion/traffic expansion; switch the host alias to the recorded known-good deployment (or previous supervised Node release); restore its compatible environment/gateway configuration; rerun liveness, auth and save/read checks. Code rollback does not undo MongoDB writes. New source snapshots use the versioned gzip codec. Rollback must target a codec-compatible deployment; old JSON-only releases cannot read new saves/imports. The new temporary SourceUpload collection/index is additive; existing project schema is unchanged. For data corruption, preserve evidence and take a fresh backup; restore only through a separately approved recovery procedure. Record incident and avoid retries that overwrite newer source.

Windows local note: a running dev server may lock Prisma's DLL. Stop that server yourself before a local rebuild, or use an isolated copy. The final release clean install/build passed in an isolated directory with dummy database configuration; the original workspace's prebuild remained locked.
