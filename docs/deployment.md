# Deployment and operations

A simple initial topology is one Node.js 24 application instance, managed MongoDB and privately reachable Ollama. Keep inference private (see [Ollama network configuration](https://docs.ollama.com/faq)); use authentication/TLS at a gateway across trust boundaries. Vercel-hosted Next.js needs a separate reachable inference service. The cloud server's loopback address is not the developer's workstation. Verify hosting duration/streaming limits against measured inference latency; streamed responses also count toward invocation duration. [Vercel function limits](https://vercel.com/docs/functions/limitations).

Build with package-lock, the six starter snapshots and their license. Output tracing includes those read-only assets. Playground persistence is MongoDB; no temporary output directory is required.

## Release checklist

1. Review unresolved advisories. The queried latest braces version remains vulnerable in the development lint chain. KaTeX is updated and compatibility tests pass. Remaining React/Vue/Next starter advisories, including a critical Next.js starter advisory, block release. See functional-completeness-report.md. Do not use npm audit fix --force to downgrade Next.js tooling.
2. Run npm ci, npm run typecheck, npm run lint -- --max-warnings=0, npm test and npm run build in a clean environment. Google Fonts network access is required at build time. Clean installation was not tested in the existing working tree; npm ls --depth=0 verified installed consistency.
3. Provision replica-set/TLS/network access and least-privilege MongoDB credentials. Review indexes and restore-tested backups. Obtain explicit approval before schema/index changes; none were applied here.
4. Set production OAuth origins, AUTH_URL, secrets and OLLAMA_BASE_URL through hosting environment settings.
5. Verify sign-in/out, ownership, create/edit/save/reopen/delete, all previews, streaming chat and cancellation in staging. Isolated browser journeys and a real dependency-free WebContainer preview pass; real OAuth, live database CRUD and all six framework previews still require staging acceptance.
6. Review the generated desktop/editor and mobile Settings screenshots, then test the full editor on target mobile devices and with assistive technology.
7. Obtain explicit operator approval before deploying. Verify health and full journeys after deployment, then observe error rate and latency before adding traffic.

## Monitoring

Collect sanitized request_failed events with requestId/type. Correlate to IDs in API responses. Do not log request bodies, tokens, private source trees or database URLs. Monitor 5xx/429 rates, database connectivity, inference timeouts/queues and RAM/GPU usage. Configure alerts from staging measurements; no uptime target has been measured.

Use /api/health for liveness and an authenticated session for readiness. Configure database driver connection/server-selection timeouts for the deployment. Readiness can take longer than liveness and model presence does not establish inference capacity. Generation retries are deliberately omitted to prevent duplicate expensive work.

## Remaining boundaries

Rate limits and inference admission are per process. Multiple replicas require shared controls at the inference gateway; no Redis/queues were added without a demonstrated deployment need.

Save All commits one combined snapshot. Content-derived revisions plus an atomic persisted-content comparison reject stale cross-tab saves. No schema fields or indexes changed. Users must resolve conflicts by reopening current saved content and reapplying their changes; do not silently discard their unsaved buffer.

Generated code, starter npm lifecycle scripts and terminal commands execute in the browser WebContainer. Never move these operations onto the host. Historical starter snapshots are not certified for production deployment. Binary assets remain limited by the legacy text-only template schema; binary round trips need a versioned encoding contract.

Chat selects from installed/permitted Ollama models and sends the selected model to inference. OLLAMA_MODEL remains the completion/default model. OLLAMA_ALLOWED_MODELS optionally limits selection; an empty value means all installed models. Durable chat autosave, cloud providers and external monitoring services were not introduced. Docker/Kubernetes are not necessary for this initial topology and were not added.

## References

Auth.js does not automatically link accounts solely by email; account lifecycle now uses its adapter: [Auth.js errors](https://authjs.dev/reference/core/errors). Ollama options/framing follow its [API documentation](https://github.com/ollama/ollama/blob/main/docs/api.md). Route params and output tracing were checked against installed Next.js docs under node_modules/next/dist/docs.

## Generated editor assets and browser checks

Normal install/prebuild prepares `public/monaco/` from the installed Monaco version, including its license. Ship that directory with other public assets. `scripts/prepare-monaco.mjs` contains a guarded 0.57.0 accessibility-cancellation workaround; review/remove it when upgrading Monaco. Unexpected runtime errors are not suppressed.

After building, `npm run test:browser` uses a synthetic identity/database and provider fixtures on port 3107. Chrome must be installed; `PLAYWRIGHT_CHANNEL` can select another installed compatible channel. `TEST_PREVIEW=1` also exercises the real browser runtime and requires network access to StackBlitz/npm. It never executes imported projects on the host. CI runs fixture browser checks and retains the full dependency audit gate.

On Windows, a running application can lock Prisma's native client during prebuild. Stop your own development server before `npm run build`. Earlier direct `npx next build` checks used the existing client; the final normal `npm run build` also passed Prisma generation. Neither establishes a clean dependency installation.

Release status and manual acceptance steps: [functional completeness report](functional-completeness-report.md). Do not deploy while that report's release blockers remain unresolved.
