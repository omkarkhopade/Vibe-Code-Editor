// Runs shipped source only inside the browser WebContainer, with synthetic app data.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import path from 'node:path';
import fs from 'node:fs/promises';
const origin = 'http://localhost:3108', secret = 'browser-fixture-secret-not-for-deployment';
const targets = (process.env.STARTER_TARGETS || 'REACT,VUE,NEXTJS,EXPRESS,HONO,ANGULAR').split(',');
const expected = { REACT: 'Hello StackBlitz!', VUE: 'Welcome to Your Vue.js App', NEXTJS: 'Get started by editing', EXPRESS: 'Hello Express!', HONO: 'Hello Hono!', ANGULAR: 'Hello' };
for (const target of targets) {
 console.log('START', target);
 if (!Object.hasOwn(expected, target)) throw new Error('Invalid starter');
 const server = spawn(process.execPath, ['--require', path.resolve('tests/browser/fixture.cjs'), 'node_modules/next/dist/bin/next', 'start', '--port', '3108'], { windowsHide: true, env: { ...process.env, NODE_ENV: 'production', AUTH_URL: origin, AUTH_SECRET: secret, DATABASE_URL: 'mongodb://127.0.0.1:1/isolated_browser_fixture', OLLAMA_BASE_URL: 'http://fixture-ollama.invalid', OLLAMA_API_KEY: '', BROWSER_STARTER: target }, stdio: ['ignore', 'pipe', 'pipe'] });
 let serverLogs = ''; server.stdout.on('data', d => serverLogs += d); server.stderr.on('data', d => serverLogs += d);
 let browser, page; const started = Date.now(); const errors = [];
 try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const name = 'authjs.session-token';
  await context.addCookies([{ name, value: await encode({ secret, salt: name, token: { sub: 'cmtestuser0000000000000001', name: 'Browser Tester', role: 'USER' } }), url: origin }]);
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/playground/cmfixture0000000000000001');
  await page.getByRole('button', { name: 'package.json', exact: true }).click();
  await Promise.race([expect(page.frameLocator('iframe[title="WebContainer Preview"]').locator('body')).toContainText(expected[target], { timeout: 240000 }), page.getByRole('heading', { name: 'Preview could not start', exact: true }).waitFor({ timeout: 240000 }).then(() => { throw new Error('Preview reported a startup failure'); })]);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ starter: target, pass: true, elapsedMs: Date.now() - started }));
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: `test-results/starter-${target}.png`, fullPage: true });
 } catch (error) {
  console.error('STARTER FAILED', target, error.message, serverLogs.slice(-2000));
  if (page) {
   console.error((await page.locator('body').innerText()).slice(-4000));
   const button = page.getByRole('button', { name: 'Download terminal log', exact: true });
   if (await button.isVisible()) { const downloaded = page.waitForEvent('download'); await button.click(); console.error((await fs.readFile(await (await downloaded).path(), 'utf8')).slice(-8000)); }
  }
  process.exitCode = 1;
 } finally { await browser?.close(); if (server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; } }
}
