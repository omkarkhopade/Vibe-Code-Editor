import { test } from 'node:test';
import assert from 'node:assert/strict';
import load from './load-ts.mjs';
const id = 'cmv3c5fcw0001f7vkgky4pjhy';
const auth = { '@/modules/auth/actions': { currentUser: async () => ({ id: 'owner' }) }, 'next/cache': { revalidatePath() {} } };
test('profile settings reject anonymous and invalid writes and update only authenticated user', async () => {
 let mutation;
 const db = { user: { update: async args => { mutation = args; } } };
 const action = load('modules/settings/actions.ts', { ...auth, '@/lib/db': { db } });
 await assert.rejects(action.updateProfile({ name: ' ' }));
 await action.updateProfile({ name: ' New name ', id: 'foreign', role: 'ADMIN' });
 assert.deepEqual(mutation, { where: { id: 'owner' }, data: { name: 'New name' } });
 const anonymous = load('modules/settings/actions.ts', { ...auth, '@/modules/auth/actions': { currentUser: async () => null }, '@/lib/db': { db } });
 await assert.rejects(anonymous.updateProfile({ name: 'No' }), /Authentication/);
});
test('browser preferences validate values and recover from corrupted storage', () => {
 const { parsePreferences, preferencesSchema } = load('modules/settings/lib/preferences.ts');
 assert.equal(parsePreferences('{broken').fontSize, 14);
 assert.equal(parsePreferences(JSON.stringify({ fontSize: 18, tabSize: 4, wordWrap: 'on', model: 'local:small' })).tabSize, 4);
 assert.equal(preferencesSchema.safeParse({ fontSize: 100 }).success, false);
});
test('OAuth credential updates are pinned to verified user and provider identity and never returned', async () => {
 let args;
 const { persistOAuthAccount } = load('modules/auth/lib/persist-oauth-account.ts', { '@/lib/db': { db: { account: { updateMany: async value => { args = value; return { count: 1 }; } } } } });
 assert.equal(await persistOAuthAccount('owner', { provider: 'github', providerAccountId: '123', access_token: 'fresh' }), undefined);
 assert.deepEqual(args.where, { userId: 'owner', provider: 'github', providerAccountId: '123' });
 assert.equal(args.data.access_token, 'fresh');
 args = null; await persistOAuthAccount('owner', { provider: 'google', access_token: 'other' }); assert.equal(args, null);
});
test('source revision rejects stale and racing saves without overwriting newer content', async () => {
 const { sourceRevision } = load('modules/playground/lib/revision.ts');
 const tree = { folderName: 'Root', items: [] }; let content = JSON.stringify(tree); let writes = 0;
 const db = { playground: { findUnique: async () => ({ id }) }, templateFile: { findUnique: async () => ({ content }), updateMany: async ({ where, data }) => { assert.equal(where.playground.userId, 'owner'); if (where.content !== content) return { count: 0 }; content = data.content; writes++; return { count: 1 }; } } };
 const { SaveUpdatedCode } = load('modules/playground/actions/index.ts', { ...auth, '@/lib/db': { db } });
 const before = sourceRevision(content); const next = { ...tree, folderName: 'Updated' };
 const result = await SaveUpdatedCode(id, next, before); assert.equal(result.revision, sourceRevision(content));
 await assert.rejects(SaveUpdatedCode(id, tree, before), /another tab/); assert.equal(writes, 1);
 db.templateFile.updateMany = async () => ({ count: 0 });
 await assert.rejects(SaveUpdatedCode(id, tree, result.revision), /changed or was deleted/);
});
test('project deletion rejects foreign owners and failed deletion never revalidates success', async () => {
 let deletes = 0, refreshes = 0;
 const db = { playground: { findUnique: async () => null, delete: async args => { assert.deepEqual(args.where, { id, userId: 'owner' }); deletes++; throw new Error('DB failure'); } } };
 const actions = load('modules/dashboard/actions/index.ts', { ...auth, '@/lib/db': { db }, 'next/cache': { revalidatePath() { refreshes++; } } });
 await assert.rejects(actions.deleteProjectById(id), /not found/); assert.equal(deletes, 0);
 db.playground.findUnique = async () => ({ id }); await assert.rejects(actions.deleteProjectById(id), /DB failure/); assert.equal(refreshes, 0);
 db.playground.delete = async () => { deletes++; }; await actions.deleteProjectById(id); assert.equal(refreshes, 1);
});
test('GitHub connection distinguishes missing, revoked, connected and rate limited without token leaks', async t => {
 let account = null;
 const mocks = { ...auth, '@/lib/db': { db: { account: { findFirst: async () => account } } } };
 const { GET } = load('app/api/github/connection/route.ts', mocks); const request = () => new Request('http://localhost/api/github/connection');
 assert.equal((await (await GET(request())).json()).status, 'disconnected');
 account = { access_token: 'private-test-token' };
 const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }));
 assert.equal((await (await GET(request())).json()).status, 'reauthorization_required');
 fetchMock.mock.mockImplementation(async () => Response.json({ login: 'test-login', token: 'should-not-escape' }));
 assert.deepEqual(await (await GET(request())).json(), { status: 'connected', login: 'test-login' });
 fetchMock.mock.mockImplementation(async () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }));
 assert.equal((await GET(request())).status, 429);
});
test('repository list requires authentication and returns only safe display fields', async t => {
 const db = { account: { findFirst: async () => ({ access_token: 'secret' }) } };
 t.mock.method(globalThis, 'fetch', async () => Response.json([{ full_name: 'o/r', html_url: 'https://github.com/o/r', default_branch: 'main', private: true, secret: 'hidden' }]));
 const { GET } = load('app/api/github/repositories/route.ts', { ...auth, '@/lib/db': { db } });
 assert.deepEqual(await (await GET(new Request('http://localhost/api/github/repositories'))).json(), { repositories: [{ name: 'o/r', url: 'https://github.com/o/r', branch: 'main', private: true }], hasNext: false });
 assert.equal((await GET(new Request('http://localhost/api/github/repositories?page=0'))).status, 400);
 const anonymous = load('app/api/github/repositories/route.ts', { ...auth, '@/modules/auth/actions': { currentUser: async () => null } });
 assert.equal((await anonymous.GET(new Request('http://localhost/api/github/repositories'))).status, 401);
});
test('upgraded KaTeX retains inline/block rendering and rejects untrusted HTML commands', async () => {
 const React = await import('react'); const { renderToStaticMarkup } = await import('react-dom/server'); const { default: Markdown } = await import('react-markdown'); const { default: math } = await import('remark-math'); const { default: katex } = await import('rehype-katex');
 const html = renderToStaticMarkup(React.createElement(Markdown, { remarkPlugins: [math], rehypePlugins: [katex] }, '$x^2$\n\n$$\n\\frac{1}{2}\n$$\n\n$\\href{javascript:alert(1)}{bad}$'));
 assert.match(html, /katex/); assert.match(html, /katex-display/); assert.doesNotMatch(html, /href="javascript:/);
});

test('preview source synchronization removes old file paths without deleting dependency directories', async () => {
 const { syncSource } = load('modules/webcontainers/hooks/sync-source.ts'); const removed = []; let mounted;
 const previous = { folderName: 'Root', items: [{ filename: 'old', fileExtension: 'js', content: 'before' }] };
 const next = { folderName: 'Root', items: [{ filename: 'new', fileExtension: 'js', content: 'after' }] };
 await syncSource({ fs: { rm: async (...args) => removed.push(args) }, mount: async value => { mounted = value; } }, previous, next);
 assert.deepEqual(removed, [['old.js', { force: true }]]); assert.equal(mounted['new.js'].file.contents, 'after');
});
