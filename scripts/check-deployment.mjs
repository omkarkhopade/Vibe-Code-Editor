// Read-only environment preflight; never logs configured values or sends prompts.
import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
let failed = false;
function report(name, ok, reason = '') { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${reason ? ': ' + reason : ''}`); if (!ok) failed = true; }
for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET']) report(name, !!process.env[name]?.trim(), 'presence only');
report('AUTH_SECRET strength', (process.env.AUTH_SECRET?.length || 0) >= 32, 'at least 32 characters required');
function httpsEndpoint(name) {
 try { const url = new URL(process.env[name] || ''); const ok = url.protocol === 'https:' && !url.username && !url.password && !['localhost','127.0.0.1','[::1]'].includes(url.hostname); report(name, ok, 'requires the actual non-loopback HTTPS deployment endpoint'); return ok ? url : null; }
 catch { report(name, false, 'missing or invalid URL'); return null; }
}
httpsEndpoint('AUTH_URL');
const inference = httpsEndpoint('OLLAMA_BASE_URL');
report('OLLAMA_API_KEY', !!process.env.OLLAMA_API_KEY, 'required for the recommended authenticated gateway');
const timeout = Number(process.env.OLLAMA_TIMEOUT_MS || 180000);
report('OLLAMA_TIMEOUT_MS', Number.isInteger(timeout) && timeout >= 1000 && timeout <= 240000, 'must leave margin within the configured 300-second invocation');
const db = new PrismaClient();
try { await db.$runCommandRaw({ ping: 1, maxTimeMS: 5000 }); report('MongoDB ping', true); }
catch { report('MongoDB ping', false, 'connection unavailable; verify network and credentials privately'); }
finally { await db.$disconnect(); }
if (inference && process.env.OLLAMA_API_KEY) {
 try {
  const response = await fetch(inference.href.replace(/\/$/, '') + '/api/tags', { redirect: 'error', headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }, signal: AbortSignal.timeout(5000) });
  const catalog = response.ok ? await response.json() : null;
  report('Authenticated Ollama model discovery', Array.isArray(catalog?.models) && catalog.models.some(item => item.name === (process.env.OLLAMA_MODEL || 'gpt-oss:20b')));
 } catch { report('Authenticated Ollama model discovery', false, 'unreachable or invalid response'); }
}
console.log('This preflight does not verify OAuth callbacks, gateway rejection of invalid keys, real inference latency, backups, or deployment.');
process.exitCode = failed ? 1 : 0;
