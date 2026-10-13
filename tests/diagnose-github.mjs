// Read-only diagnostic. Prints aggregate status only, never tokens or account identifiers.
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { PrismaClient } from '@prisma/client';
loadEnvConfig(process.cwd());
const db = new PrismaClient();
try {
  const accounts = await db.account.findMany({ where: { provider: 'github' }, select: { access_token: true, expires_at: true, scope: true } });
  const summary = { accounts: accounts.length, missingToken: 0, expiredMetadata: 0, accepted: 0, rejected401: 0, denied403: 0, other: 0, privateScope: 0 };
  for (const account of accounts) {
    if (account.scope?.split(/[ ,]+/).includes('repo')) summary.privateScope++;
    if (account.expires_at && account.expires_at * 1000 < Date.now()) summary.expiredMetadata++;
    if (!account.access_token) { summary.missingToken++; continue; }
    try {
      const response = await fetch('https://api.github.com/user', { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${account.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
      if (response.ok) summary.accepted++; else if (response.status === 401) summary.rejected401++; else if (response.status === 403) summary.denied403++; else summary.other++;
      await response.body?.cancel();
    } catch { summary.other++; }
  }
  console.log(JSON.stringify(summary));
} catch { console.error('Read-only GitHub diagnostic could not complete; no credentials were printed.'); process.exitCode = 1; }
finally { await db.$disconnect(); }
