// Explicit test-process preload, never imported by application code.
if (process.env.DATABASE_URL !== 'mongodb://127.0.0.1:1/isolated_browser_fixture' || process.env.AUTH_SECRET !== 'browser-fixture-secret-not-for-deployment') throw new Error('Fixture isolation required');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node preload must be CommonJS
const Module = require('node:module'), originalLoad = Module._load;
const user = { id: 'cmtestuser0000000000000001', name: 'Browser Tester', email: 'browser@example.invalid', role: 'USER', image: null, accounts: [{ provider: 'github' }] };
const source = { folderName: 'fixture', items: [{ filename: 'index', fileExtension: 'js', content: 'console.log("fixture");\n' }, { filename: 'package', fileExtension: 'json', content: JSON.stringify({ scripts: { dev: 'node index.js' } }) }] };
const projects = new Map(); let counter = 1;
function create(data) {
 const id = 'cmfixture' + String(counter++).padStart(16, '0'), nested = data.templateFiles?.create;
 const p = { id, title: data.title, description: data.description || '', template: data.template || 'EXPRESS', userId: data.userId, user, createdAt: new Date(), updatedAt: new Date(), Starmark: [], templateFiles: nested ? (Array.isArray(nested) ? nested : [nested]) : [{ content: JSON.stringify(source) }] };
 projects.set(id, p); return structuredClone(p);
}
create({ title: 'Browser fixture', userId: user.id });
function owned(where) { const p = projects.get(where.id); return p && (!where.userId || p.userId === where.userId) ? p : null; }
const db = {
 user: { findUnique: async ({ where }) => where.id === user.id ? structuredClone(user) : null, update: async ({ where, data }) => { if (where.id !== user.id) throw new Error('Denied'); Object.assign(user, data); return user; } },
 account: { findFirst: async () => ({ access_token: 'synthetic-fixture-token', expires_at: null }), updateMany: async () => ({ count: 1 }) },
 playground: {
  findMany: async ({ where }) => structuredClone([...projects.values()].filter(p => p.userId === where.userId)), findUnique: async ({ where }) => structuredClone(owned(where)), create: async ({ data }) => create(data),
  update: async ({ where, data }) => { const p = owned(where); if (!p) throw new Error('Not found'); if (data.templateFiles) { if (p.templateFiles.length) throw new Error('Unique constraint'); p.templateFiles = [data.templateFiles.create]; } else Object.assign(p, data); return structuredClone(p); },
  delete: async ({ where }) => { const p = owned(where); if (!p) throw new Error('Not found'); projects.delete(p.id); return p; }
 },
 templateFile: { findUnique: async ({ where }) => structuredClone(projects.get(where.playgroundId)?.templateFiles[0] || null), updateMany: async ({ where, data }) => { const p = projects.get(where.playgroundId), f = p?.templateFiles[0]; if (!f || f.content !== where.content || p.userId !== where.playground.userId) return { count: 0 }; f.content = data.content; return { count: 1 }; } },
 starMark: { upsert: async ({ create: data }) => { projects.get(data.playgroundId).Starmark = [{ isMarked: true }]; return data; }, deleteMany: async ({ where }) => { projects.get(where.playgroundId).Starmark = []; return { count: 1 }; } }
};
global.prisma = db;
Module._load = function(name, ...rest) { if (name.startsWith('@prisma/client')) return { PrismaClient: class { constructor() { return db; } } }; return originalLoad.call(this, name, ...rest); };
const realFetch = global.fetch;
global.fetch = async (input, options) => {
 const url = String(input);
 if (url.startsWith('http://fixture-ollama.invalid')) { if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'gpt-oss:20b' }, { name: 'fixture:small' }] }); const body = JSON.parse(options.body); return body.stream ? new Response(JSON.stringify({ response: 'Fixture AI response', done: true }) + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } }) : Response.json({ response: '  // fixture suggestion\n' }); }
 if (url.startsWith('https://api.github.com')) {
  if (url === 'https://api.github.com/user') return Response.json({ login: 'fixture-user' });
  if (url.includes('/user/repos?')) return Response.json([{ full_name: 'fixture/node-project', html_url: 'https://github.com/fixture/node-project', default_branch: 'main', private: false }]);
  if (url.includes('/commits/')) return Response.json({ sha: 'b'.repeat(40), commit: { tree: { sha: 'c'.repeat(40) } } });
  if (url.includes('/git/trees/')) return Response.json({ tree: source.items.map((file, index) => ({ path: file.filename + '.' + file.fileExtension, sha: String(index + 1).repeat(40), type: 'blob', mode: '100644', size: Buffer.byteLength(file.content) })) });
  if (url.includes('/git/blobs/')) return Response.json({ encoding: 'base64', content: Buffer.from(source.items[Number(url.split('/').pop()[0]) - 1].content).toString('base64') });
  return Response.json({ default_branch: 'main' });
 }
 return realFetch(input, options);
};
