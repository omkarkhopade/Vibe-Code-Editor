import { test } from 'node:test';
import assert from 'node:assert/strict';
import load from './load-ts.mjs';
const owner = 'test-user';
function fixture({ truncated = false, extras = [] } = {}) {
  const source = { 'package.json': JSON.stringify({ scripts: { dev: 'node index.js' }, dependencies: { express: '4.21.0' } }), 'index.js': 'console.log("hello");', '.env.local': 'PRIVATE=value', 'asset.png': 'binary', 'link': 'outside' };
  const blobs = new Map();
  const entries = Object.entries(source).map(([path, content], index) => {
    const sha = (index + 1).toString(16).padStart(40, '0');
    blobs.set(sha, { encoding: 'base64', content: Buffer.from(content).toString('base64') });
    return { path, sha, type: 'blob', mode: path === 'link' ? '120000' : '100644', size: Buffer.byteLength(content) };
  });
  const calls = [];
  return { calls, fetch: async (url, options) => {
    calls.push({ url, options });
    assert.ok(url.startsWith('https://api.github.com/repos/example/project'));
    if (url.includes('/git/blobs/')) return Response.json(blobs.get(url.split('/').pop()));
    if (url.includes('/git/trees/')) return Response.json({ tree: [...entries, ...extras], truncated });
    if (url.includes('/commits/')) return Response.json({ sha: 'b'.repeat(40), commit: { tree: { sha: 'c'.repeat(40) } } });
    return Response.json({ default_branch: 'main' });
  } };
}

test('repository parser accepts GitHub HTTPS and rejects SSRF, credentials and path injection', () => {
  const { parseRepository } = load('modules/github/lib/import-repository.ts');
  assert.deepEqual(parseRepository('https://github.com/example/project.git'), { owner: 'example', repo: 'project' });
  for (const value of ['http://github.com/a/b', 'https://localhost/a/b', 'https://github.com.evil.test/a/b', 'https://token@github.com/a/b', 'https://github.com/a/b/tree/main', 'https://github.com/a/%2e%2e', 'https://github.com/a/b?x=1']) assert.throws(() => parseRepository(value));
});
test('imports a pinned Node snapshot and excludes environment files, binary assets and symlinks', async t => {
  const data = fixture(); t.mock.method(globalThis, 'fetch', data.fetch);
  const { importRepository } = load('modules/github/lib/import-repository.ts');
  const result = await importRepository('https://github.com/example/project', 'feature/test', 'test-token', new AbortController().signal);
  assert.equal(result.files, 2); assert.equal(result.skipped, 3); assert.equal(result.template, 'EXPRESS');
  assert.deepEqual(result.root.items.map(file => file.filename), ['index', 'package']);
  assert.ok(data.calls.some(call => call.url.endsWith('/commits/feature%2Ftest')));
  assert.ok(data.calls.some(call => call.url.includes('/git/trees/' + 'c'.repeat(40))));
  assert.ok(data.calls.every(call => call.options.redirect === 'error' && call.options.headers.Authorization === 'Bearer test-token'));
  assert.equal(data.calls.filter(call => call.url.includes('/git/blobs/')).length, 2);
});
test('rejects truncated trees and unsafe file names rather than saving a partial repository', async t => {
  const mock = t.mock.method(globalThis, 'fetch', fixture({ truncated: true }).fetch);
  const { importRepository } = load('modules/github/lib/import-repository.ts');
  await assert.rejects(importRepository('https://github.com/example/project', undefined, undefined, new AbortController().signal), error => error.status === 413);
  mock.mock.mockImplementation(fixture({ extras: [{ path: '../escape', type: 'blob', mode: '100644', sha: 'a'.repeat(40), size: 1 }] }).fetch);
  await assert.rejects(importRepository('https://github.com/example/project', undefined, undefined, new AbortController().signal), error => error.status === 422);
});
test('GitHub access and rate errors are controlled', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
  const { importRepository } = load('modules/github/lib/import-repository.ts');
  const run = () => importRepository('https://github.com/example/project', undefined, undefined, new AbortController().signal);
  await assert.rejects(run(), error => error.status === 404);
  mock.mock.mockImplementation(async () => new Response('', { status: 403 }));
  await assert.rejects(run(), error => error.status === 403);
  mock.mock.mockImplementation(async () => new Response("", { status: 403, headers: { "x-ratelimit-remaining": "0" } }));
  await assert.rejects(run(), error => error.status === 429);
});
test('import route authenticates and creates owned playground/source atomically', async () => {
  let created;
  const db = { account: { findFirst: async args => { assert.equal(args.where.userId, owner); return null; } }, playground: { create: async args => { created = args.data; return { id: 'new-id' }; } } };
  const source = { folderName: 'project', items: [{ filename: 'index', fileExtension: 'js', content: 'test' }] };
  const mocks = { '@/modules/auth/actions': { currentUser: async () => ({ id: owner }) }, '@/lib/db': { db }, '@/modules/github/lib/import-repository': { importRepository: async () => ({ title: 'project', source: 'example/project', commit: 'a'.repeat(40), root: source, template: 'EXPRESS', files: 1, skipped: 0 }) } };
  const { POST } = load('app/api/github/import/route.ts', mocks);
  const request = () => new Request('http://localhost/api/github/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository: 'https://github.com/example/project' }) });
  assert.equal((await POST(request())).status, 201);
  assert.equal(created.userId, owner); assert.deepEqual(JSON.parse(created.templateFiles.create.content), source);
  assert.equal((await POST(request())).status, 429);
  const anonymous = load('app/api/github/import/route.ts', { ...mocks, '@/modules/auth/actions': { currentUser: async () => null } });
  assert.equal((await anonymous.POST(request())).status, 401);
});

test('revoked token falls back to anonymous public import without leaking credentials', async t => {
 const data = fixture(); let denied = 0;
 t.mock.method(globalThis, 'fetch', async (url, options) => { if (options.headers.Authorization) { denied++; return new Response('', { status: 401 }); } return data.fetch(url, options); });
 const { importRepository } = load('modules/github/lib/import-repository.ts');
 const result = await importRepository('https://github.com/example/project', undefined, 'revoked', new AbortController().signal);
 assert.equal(result.files, 2); assert.equal(denied, 1); assert.ok(data.calls.every(call => !call.options.headers.Authorization));
});
