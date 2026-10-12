# Engineering progress — 2026-10-12

Completed: template 500 reproduced against the real reported NEXTJS playground and corrected handler verified 200 (read-only MongoDB, session boundary stubbed); authorized in-memory template loading; ownership/auth hardening; save/duplicate/path fixes; bounded configurable Ollama; streaming/cancellation; runtime cleanup; rename; required starter packaging; health/CI/docs.

Validation: 20 passing tests, zero TypeScript errors, zero ESLint warnings, final production build PASS, six starters present in deployment trace, no .env in trace. Live minimal inference PASS in 159922 ms. See engineering-report.md for exact scope and limitations.

Initial database initialization failures were sandbox-network limitations; authorized read-only retry succeeded. Browser connection failed twice with missing sandboxPolicy. OAuth/full E2E and screenshots remain NOT VERIFIED. Dependency audit remains FAIL (5 high development-tool chain entries, 4 low math-renderer entries). No deployment, migration, model changes or private data writes performed.

Next external acceptance work: clean installation, browser/OAuth/editor/preview and screenshot tests; dependency compatibility/security review; infrastructure provisioning and explicit deployment approval. Detailed steps are in deployment.md. Resume from this verified state.

Final production smoke checks: eight expected endpoint statuses passed with process-only AUTH_URL=http://localhost:3001. Without the required production origin, Auth.js correctly rejected an untrusted host; this configuration requirement is documented.
