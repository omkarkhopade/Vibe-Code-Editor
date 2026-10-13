import { test } from 'node:test';
import assert from 'node:assert/strict';
import load from './load-ts.mjs';
const id = 'cmv3c5fcw0001f7vkgky4pjhy';
const valid = { folderName: 'Root', items: [{ filename: 'README', fileExtension: '', content: 'hello' }] };
test('validation rejects traversal, prototype keys, duplicates, deep and oversized trees', () => {
  const { isTemplateFolder } = load('modules/playground/lib/validation.ts');
  assert.ok(isTemplateFolder(valid));
  for (const filename of ['../secret', 'a/b', 'a\\b', '__proto__', '..']) assert.equal(isTemplateFolder({ ...valid, items: [{ ...valid.items[0], filename }] }), false);
  assert.equal(isTemplateFolder({ ...valid, items: [valid.items[0], valid.items[0]] }), false);
  assert.equal(isTemplateFolder({ ...valid, items: [{ ...valid.items[0], content: 'x'.repeat(4 * 1024 * 1024 + 1) }] }), false);
  let tree = valid; for (let i = 0; i < 32; i++) tree = { folderName: 'nested', items: [tree] };
  assert.equal(isTemplateFolder(tree), false);
});
test('extensionless and dot files retain their names in WebContainer', () => {
  const { transformToWebContainerFormat } = load('modules/webcontainers/hooks/transformer.ts');
  assert.deepEqual(transformToWebContainerFormat(valid), { README: { file: { contents: 'hello' } } });
  assert.deepEqual(transformToWebContainerFormat({ ...valid, items: [{ filename: '.gitignore', fileExtension: '', content: 'dist' }] }), { '.gitignore': { file: { contents: 'dist' } } });
});
test('all playground actions reject unauthenticated callers before querying private data', async () => {
  const mocks = { '@/modules/auth/actions': { currentUser: async () => null }, '@/lib/db': { db: new Proxy({}, { get() { throw new Error('database must not be called'); } }) }, 'next/cache': { revalidatePath() {} } };
  const actions = load('modules/dashboard/actions/index.ts', mocks);
  for (const [name, args] of [['getAllPlaygroundForUser', []], ['deleteProjectById', [id]], ['editProjectById', [id, {}]], ['duplicateProjectById', [id]], ['toggleStarMarked', [id, true]], ['createPlayground', [{}]]]) await assert.rejects(actions[name](...args), /Authentication required/);
  const playground = load('modules/playground/actions/index.ts', mocks);
  await assert.rejects(playground.getPlaygroundById(id), /Authentication required/);
  await assert.rejects(playground.SaveUpdatedCode(id, valid, null), /Authentication required/);
});
test('foreign playground save is denied, failed saves reject', async () => {
  const base = { '@/modules/auth/actions': { currentUser: async () => ({ id: 'owner' }) } };
  let writes = 0;
  const db = { playground: { findUnique: async args => { assert.equal(args.where.userId, 'owner'); return null; } }, templateFile: { findUnique: async () => null } };
  const actions = load('modules/playground/actions/index.ts', { ...base, '@/lib/db': { db } });
  await assert.rejects(actions.SaveUpdatedCode(id, valid, null), /not found/); assert.equal(writes, 0);
  db.playground.findUnique = async () => ({ id });
  db.playground.update = async () => { writes++; throw new Error('write failed'); };
  await assert.rejects(actions.SaveUpdatedCode(id, valid, null), /write failed/); assert.equal(writes, 1);
});
test('project duplication retains saved source and uses the authenticated owner', async () => {
  let created;
  const db = { playground: { findUnique: async () => ({ id, title: 'Example', template: 'REACT', description: '', templateFiles: [{ content: JSON.stringify(valid) }] }), create: async args => { created = args.data; return args.data; } } };
  const actions = load('modules/dashboard/actions/index.ts', { '@/modules/auth/actions': { currentUser: async () => ({ id: 'owner' }) }, '@/lib/db': { db }, 'next/cache': { revalidatePath() {} } });
  await actions.duplicateProjectById(id);
  assert.equal(created.userId, 'owner'); assert.equal(created.templateFiles.create[0].content, JSON.stringify(valid));
});

test('same-named files remain independent and multi-file saves merge in one snapshot', () => {
  const first = { filename: 'index', fileExtension: 'ts', content: 'same' };
  const second = { ...first };
  const tree = { folderName: 'Root', items: [{ folderName: 'a', items: [first] }, { folderName: 'b', items: [second] }] };
  const { generateFileId, findFilePath, updateFilesByPath } = load('modules/playground/lib/index.ts');
  assert.equal(generateFileId(first, tree), 'a/index.ts'); assert.equal(generateFileId(second, tree), 'b/index.ts');
  assert.equal(findFilePath({ ...first }, tree), null);
  const updated = updateFilesByPath(tree, new Map([['a/index.ts', 'one'], ['b/index.ts', 'two']]));
  assert.equal(updated.items[0].items[0].content, 'one'); assert.equal(updated.items[1].items[0].content, 'two');
  assert.equal(first.content, 'same');
});
test('file explorer preserves tabs and source after rejected delete and rename', async () => {
  const { useFileExplorer } = load('modules/playground/hooks/useFileExplorer.tsx', { sonner: { toast: { error() {}, success() {} } } });
  const tree = structuredClone(valid);
  useFileExplorer.getState().setTemplateData(tree);
  useFileExplorer.getState().openFile(tree.items[0]);
  const reject = async () => { throw new Error('rejected'); };
  await assert.rejects(useFileExplorer.getState().handleDeleteFile(tree.items[0], '', reject));
  assert.equal(useFileExplorer.getState().openFiles.length, 1);
  assert.deepEqual(useFileExplorer.getState().templateData, tree);
  await assert.rejects(useFileExplorer.getState().handleRenameFile(tree.items[0], 'OTHER', '', '', reject));
  assert.equal(useFileExplorer.getState().openFiles[0].id, 'README');
  assert.deepEqual(useFileExplorer.getState().templateData, tree);
});
