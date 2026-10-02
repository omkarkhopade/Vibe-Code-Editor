# Dependency upgrade ? 2026-10-02

All direct packages were checked against the npm registry. Dependencies with compatible newer releases and transitive dependencies were updated, and package-lock.json was regenerated. Use Node.js 24 and npm ci for a reproducible installation.

## Main updates

- Next.js 16.3.8, React/React DOM 19.3.0, Tailwind CSS 4.3.3.
- Monaco 0.57.0, Recharts 3.10.1, React Day Picker 10.0.2, React Resizable Panels 4.14.1, Lucide 1.50.0, and xterm 6.0.0.
- Deprecated xterm-addon packages replaced with maintained @xterm/addon packages and matching imports.
- Middleware renamed to proxy.ts; ESLint uses the flat Next.js configuration and its own CLI. Next.js 16 no longer runs lint as part of the build.
- Calendar class names, chart content types, panel components/orientation/percentage sizes, removed brand icons, and Markdown rendering migrated to current APIs.
- Prisma generator corrected, missing models added for the existing app, and OAuth token field names aligned with the adapter. The local MongoDB provider and existing User fields/CUID identifiers were preserved. Token field mappings retain camelCase names in MongoDB. No database changes were applied.
- Prisma generation runs after installation and before builds. Prisma uses the same environment file loading as Next.js.

## Compatibility constraints

| Package | Selected version | Reason |
| --- | --- | --- |
| prisma / @prisma/client | 6.19.3 | Current stable MongoDB-compatible pair. Prisma 7 lacks its MongoDB connector; Prisma 8 is a release candidate. |
| next-auth | 5.0.0-beta.32 | Latest existing v5 beta line; the registry's latest tag points to v4, which would break the current auth API. |
| eslint | 9.39.5 | eslint-plugin-react still declares compatibility only through ESLint 9. |
| typescript | 6.0.3 | typescript-eslint supports TypeScript below 6.1; TypeScript 7 is outside that range. |
| @types/node | 24.19.1 | Matches the project's Node.js 24 runtime instead of describing Node.js 26 APIs. |

The scoped npm overrides update Monaco's DOMPurify to 3.4.16+ and Prisma config's deepmerge-ts to 8.0.2+ to resolve audit findings. The deepmerge-ts major release changes Map merging; this project's plain-object Prisma config was verified through validation and client generation. Revisit these overrides when upstream packages incorporate the fixes.

## Verification

- Production build: passed, including Next.js TypeScript checks and route generation.
- Standalone type check: passed.
- Prisma schema validation and client generation: passed.
- npm audit: zero vulnerabilities.
- Full npm dependency tree: no missing or invalid dependencies.
- Production HTTP smoke checks (using a temporary AUTH_URL and random AUTH_SECRET for the test server): home and sign-in return 200, sign-in renders both providers, the anonymous auth session returns null, dashboard redirects anonymous requests to sign-in, and WebContainer isolation headers are present.
- Browser automation could not connect in this environment; visual behavior and authenticated OAuth/database/WebContainer flows were not verified.
- ESLint reports 63 errors and 45 warnings in application code, including explicit any types, TypeScript suppression comments, and React effect/ref rules. These remain visible; lint rules were not disabled to make the upgrade pass.
- Turbopack warns that the template route's dynamic filesystem path traces the whole project. The referenced vibecode-starters directory is empty in this checkout, so project-template creation requires those starter files.

Builds need network access to download the existing Google fonts. Before using the database, review the completed schema against existing collections and apply it separately with npx prisma db push. Set AUTH_URL to the actual application origin for a self-hosted production server; without it, Auth.js can reject requests with UntrustedHost. The local environment also lacks AUTH_SECRET; set a random secret before running the production server. Authenticated behavior still requires working OAuth credentials and MongoDB.

References: [Next.js 16 migration](https://nextjs.org/docs/app/guides/upgrading/version-16), [MongoDB Prisma integration](https://www.mongodb.com/docs/drivers/node/current/integrations/prisma/), [deepmerge-ts 8 changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).
