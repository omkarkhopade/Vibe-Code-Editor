# Vercel setup checklist — 2026-10-17

The application is not approved for public release yet. See [release evidence](final-release-report.md). These steps describe the remaining setup; no deployment, model download or environment edit has been performed by the agent.

## 1. Separate staging from production

Use distinct MongoDB databases and users for staging and production. If `vibe-code-editor` will hold production data, create a separate staging database. Use a TLS replica set, backups and appropriate network access for your Vercel deployment. Test restoring a backup into another database.

Chunked saves automatically create only the temporary `SourceUpload` collection and its `source_upload_expiry` TTL index. The application user needs permission to create that index and read/write/delete temporary records. Uploads expire after 15 minutes; application checks reject expired uploads even before MongoDB's background TTL deletion. One upload per account is allowed at a time. Existing project schema/indexes are not migrated by this feature.

## 2. Provide an always-on Ollama server

Vercel hosts the Next.js app, not the model. Provision a separate machine with sufficient RAM/GPU capacity, install Ollama using its [Linux guide](https://docs.ollama.com/linux), and install the approved model there. Currently the app still defaults to `gpt-oss:20b`.

Keep Ollama bound to `127.0.0.1:11434` when the gateway is on the same server. Do not expose that port publicly. Point an inference subdomain at a TLS gateway on that machine. Configure the gateway to:

- Require and validate a long random bearer credential on every request.
- Permit only `GET /api/tags` and `POST /api/generate`; reject model-management endpoints.
- Forward to loopback Ollama, support streaming and cancellation, and avoid logging authorization headers, prompts or source.
- Bound request sizes, concurrent inference and queue length; use global abuse controls in addition to the app's process-local limits.
- Allow the app's 180-second timeout with margin, while staying below its 300-second function budget.

Use a maintained authenticated reverse proxy; HTTPS alone does not authenticate requests. Caddy's [reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) covers streaming and upstream timeout settings, but authentication and admission controls must also be configured. Verify missing/wrong credentials are rejected, valid credentials list models, generation streams, and cancellation releases work. Benchmark cold and warm requests on the actual server before launch. [Ollama configuration](https://docs.ollama.com/faq).

## 3. Configure Vercel and OAuth

Import the repository with the Next.js preset, Node.js 24, repository root, install command `npm ci`, and build command `npm run build`. Use a stable staging domain. Keep production credentials out of preview environments.

Set these server-only variables in Vercel's environment settings using actual private values:

```dotenv
DATABASE_URL=<staging MongoDB connection string>
AUTH_SECRET=<independent high-entropy staging secret>
AUTH_URL=https://<stable-staging-domain>
AUTH_GITHUB_ID=<staging GitHub OAuth application ID>
AUTH_GITHUB_SECRET=<staging GitHub OAuth secret>
AUTH_GOOGLE_ID=<staging Google OAuth client ID>
AUTH_GOOGLE_SECRET=<staging Google OAuth secret>
OLLAMA_BASE_URL=https://<authenticated-inference-domain>
OLLAMA_API_KEY=<credential verified by that gateway>
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_ALLOWED_MODELS=gpt-oss:20b
OLLAMA_TIMEOUT_MS=180000
```

Do not prefix secrets with `NEXT_PUBLIC_`. Register these exact callbacks with the providers:

- `https://<stable-staging-domain>/api/auth/callback/github`
- `https://<stable-staging-domain>/api/auth/callback/google`

For Google also set the HTTPS origin and appropriate consent/test-user configuration. Repeat using separate production credentials and the production domain later. Real provider sign-in must be checked on those origins; local fixture tests cannot certify it.

## 4. Verify before promotion

Run `node scripts/check-deployment.mjs` in an environment configured with the intended values. It reports presence/HTTPS configuration, MongoDB connectivity and authenticated model discovery without printing secrets. It does not prove OAuth, performance or gateway authentication rejection.

Run Linux CI, resolve the remaining dependency audit failures, then deploy to staging. Check sign-in/out with both providers, GitHub identity/import, create/edit/save/reopen/duplicate/delete with disposable projects, two-account ownership, conflicting saves, near-4-MiB saves, all six previews, chat/completion/cancellation and mobile navigation. Verify HTTPS and browser cross-origin isolation. Configure health monitoring and error alerts.

The source API uses 1 MiB chunks to stay below [Vercel's 4.5 MB request/response limit](https://vercel.com/docs/functions/limitations). Still test on Vercel itself: localhost tests do not verify its routing, Linux packaging or function duration settings.

Record a rollback deployment that understands `vibecode:gzip:v1:` source snapshots. An older JSON-only deployment cannot read newly saved/imported snapshots. Code rollback does not reverse database writes; never restore over production without a separate recovery plan.

## Optional model change — awaiting your approval

For your modest GPU capacity, start by benchmarking `qwen2.5-coder:1.5b` for short completions; its published download is approximately 986 MB. `qwen2.5-coder:7b` is approximately 4.7 GB and is a candidate for more capable chat, with higher memory requirements. Runtime memory exceeds download size. These are candidates, not measured speed guarantees. [1.5B model](https://ollama.com/library/qwen2.5-coder:1.5b), [7B model](https://ollama.com/library/qwen2.5-coder:7b).

After approval, the procedure is:

1. Run `ollama pull qwen2.5-coder:1.5b` on the machine actually serving Ollama.
2. Confirm installation with `ollama list`; use `ollama ps` while generating to inspect CPU/GPU placement.
3. Add the exact name to `OLLAMA_ALLOWED_MODELS` if that allowlist is set. Select it in the existing chat model selector for a trial.
4. To change the server default, set `OLLAMA_MODEL=qwen2.5-coder:1.5b`, restart the local Next server or redeploy the Vercel app, and update any saved model preference explicitly.
5. Compare the same prompts with cold and warm runs, time to first visible token, total time and code correctness. Keep `gpt-oss:20b` available until the replacement is accepted.

Separate automatic models for chat and completion would require an additional reviewed change; do not assume changing the default overrides every saved user selection. No model or inference setting has been changed in this pass.
