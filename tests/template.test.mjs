import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import load from './load-ts.mjs';
const id = 'cmv3c5fcw0001f7vkgky4pjhy';
function route({ user = { id: 'owner' }, record = { template: 'NEXTJS' }, failure } = {}) {
  return load('app/api/template/[id]/route.ts', {
    '@/modules/auth/actions': { currentUser: async () => user },
    '@/lib/db': { db: { playground: { findUnique: async args => {
      assert.equal(args.where.userId, 'owner');
      if (failure) throw failure;
      return record;
    } } } },
  }).GET;
}
const request = (handler, value = id) => handler(new Request('http://localhost/api/template/' + value), { params: Promise.resolve({ id: value }) });
test('Next.js starter loads in memory with the existing response contract', async () => {
  const response = await request(route());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.ok(body.templateJson.items.some(item => item.filename === 'package'));
});
test('invalid ID, unauthenticated, absent/foreign record and invalid template are controlled', async () => {
  assert.equal((await request(route(), '../bad')).status, 400);
  assert.equal((await request(route({ user: null }))).status, 401);
  assert.equal((await request(route({ record: null }))).status, 404);
  assert.equal((await request(route({ record: { template: '__proto__' } }))).status, 422);
});
test('database initialization failure is caught and sanitized', async () => {
  const error = new Error('private connection string'); error.name = 'PrismaClientInitializationError';
  const response = await request(route({ failure: error }));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private connection'));
});
test('concurrent same-template requests return identical data', async () => {
  const handler = route();
  const responses = await Promise.all(Array.from({ length: 8 }, () => request(handler)));
  assert.ok(responses.every(response => response.status === 200));
  const bodies = await Promise.all(responses.map(response => response.json()));
  bodies.forEach(body => assert.deepEqual(body, bodies[0]));
});
test('all mapped starter directories exist and match the schema', async () => {
  const { templatePaths } = load('lib/template.ts');
  const { scanTemplateDirectory } = load('modules/playground/lib/path-to-json.ts');
  const { isTemplateFolder } = load('modules/playground/lib/validation.ts');
  for (const value of Object.values(templatePaths)) {
    assert.ok(isTemplateFolder(await scanTemplateDirectory(path.join(process.cwd(), "vibecode-starters", value))), value);
  }
});

test('missing template files return a controlled failure', async () => {
  const handler = load('app/api/template/[id]/route.ts', {
    '@/modules/auth/actions': { currentUser: async () => ({ id: 'owner' }) },
    '@/lib/db': { db: { playground: { findUnique: async () => ({ template: 'NEXTJS' }) } } },
    '@/lib/template': { templatePaths: { NEXTJS: 'missing-test-template' } },
  }).GET;
  assert.equal((await request(handler)).status, 503);
});
test('scanner excludes secrets and symlinks and propagates missing directory errors', async t => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-template-test-'));
  const nested = path.join(directory, 'nested'); await fs.mkdir(nested);
  const files = ['.env.production.local', 'private.pem', 'README'];
  for (const name of files) await fs.writeFile(path.join(directory, name), 'test');
  // Directory junctions work without Windows symlink privilege.
  const junction = path.join(directory, 'linked');
  await fs.symlink(nested, junction, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(async () => { await fs.unlink(junction); for (const name of files) await fs.unlink(path.join(directory, name)); await fs.rmdir(nested); await fs.rmdir(directory); });
  const { scanTemplateDirectory } = load('modules/playground/lib/path-to-json.ts');
  const result = await scanTemplateDirectory(directory);
  assert.deepEqual(result.items.map(item => item.folderName || item.filename), ['nested', 'README']);
  await assert.rejects(scanTemplateDirectory(path.join(directory, 'absent')));
  await assert.rejects(scanTemplateDirectory(directory, { maxFileSize: 1 }), /size limit/);
});
