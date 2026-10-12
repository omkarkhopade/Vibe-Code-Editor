# Deployment and operations

A simple initial topology is one Node.js 24 application instance, managed MongoDB and privately reachable Ollama. Keep inference private (see [Ollama network configuration](https://docs.ollama.com/faq)); use authentication/TLS at a gateway across trust boundaries. Vercel-hosted Next.js needs a separate reachable inference service. The cloud server's loopback address is not the developer's workstation. Verify hosting duration/streaming limits against measured inference latency; streamed responses also count toward invocation duration. [Vercel function limits](https://vercel.com/docs/functions/limitations).

Build with package-lock, the six starter snapshots and their license. Output tracing includes those read-only assets. Playground persistence is MongoDB; no temporary output directory is required.

## Release checklist

1. Review unresolved advisories. The queried latest braces version remains vulnerable in the development lint chain. KaTeX requires a separately tested compatibility upgrade. Do not use npm audit fix --force to downgrade Next.js tooling.
2. Run npm ci, npm run typecheck, npm run lint -- --max-warnings=0, npm test and npm run build in a clean environment. Google Fonts network access is required at build time. Clean installation was not tested in the existing working tree; npm ls --depth=0 verified installed consistency.
3. Provision replica-set/TLS/network access and least-privilege MongoDB credentials. Review indexes and restore-tested backups. Obtain explicit approval before schema/index changes; none were applied here.
4. Set production OAuth origins, AUTH_URL, secrets and OLLAMA_BASE_URL through hosting environment settings.
5. Verify sign-in/out, ownership, create/edit/save/reopen/delete, all previews, streaming chat and cancellation in staging. Browser/E2E verification remains mandatory because the audit browser connection failed.
6. Compare desktop/mobile screenshots. Static className/style checks passed; they do not replace visual checks.
7. Obtain explicit operator approval before deploying. Verify health and full journeys after deployment, then observe error rate and latency before adding traffic.

## Monitoring

Collect sanitized request_failed events with requestId/type. Correlate to IDs in API responses. Do not log request bodies, tokens, private source trees or database URLs. Monitor 5xx/429 rates, database connectivity, inference timeouts/queues and RAM/GPU usage. Configure alerts from staging measurements; no uptime target has been measured.

Use /api/health for liveness and an authenticated session for readiness. Configure database driver connection/server-selection timeouts for the deployment. Readiness can take longer than liveness and model presence does not establish inference capacity. Generation retries are deliberately omitted to prevent duplicate expensive work.

## Remaining boundaries

Rate limits and inference admission are per process. Multiple replicas require shared controls at the inference gateway; no Redis/queues were added without a demonstrated deployment need.

Whole-project saves remain last-write-wins across tabs. Same-page Save All now commits one combined snapshot, but cross-tab optimistic concurrency requires a reviewed version/data-transition design. No schema fields or indexes changed.

Generated code, starter npm lifecycle scripts and terminal commands execute in the browser WebContainer. Never move these operations onto the host. Historical starter snapshots are not certified for production deployment. Binary assets remain limited by the legacy text-only template schema; binary round trips need a versioned encoding contract.

The existing model-selector appearance is preserved; actual inference uses server OLLAMA_MODEL. Durable chat autosave, multiple providers and external monitoring services were not introduced. Docker/Kubernetes are not necessary for this initial topology and were not added.

## References

Auth.js does not automatically link accounts solely by email; account lifecycle now uses its adapter: [Auth.js errors](https://authjs.dev/reference/core/errors). Ollama options/framing follow its [API documentation](https://github.com/ollama/ollama/blob/main/docs/api.md). Route params and output tracing were checked against installed Next.js docs under node_modules/next/dist/docs.
