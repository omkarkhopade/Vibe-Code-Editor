// Explicit opt-in: creates and deletes only uniquely identified test accounts/projects.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { PrismaClient } from '@prisma/client';
import load from './load-ts.mjs';
if (process.env.RUN_LIVE_SOURCE_TEST !== '1') throw new Error('Set RUN_LIVE_SOURCE_TEST=1 to authorize dedicated live test records');
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const db = new PrismaClient(), users = [], projects = [];
const originalFetch = global.fetch;
let actingUser;
try {
 for (let i = 0; i < 2; i++) users.push(await db.user.create({ data: { name: 'Release source transfer test', email: `release-test-${randomUUID()}@example.invalid` }, select: { id: true } }));
 actingUser = users[0];
 const observedDb = new Proxy(db, { get(target, name) { if (name === '$runCommandRaw') return async command => { try { return await target.$runCommandRaw(command); } catch (error) { console.log(JSON.stringify({ command: Object.keys(command).filter(k => k !== 'maxTimeMS')[0], code: error.code, serverCode: error.meta?.code, reasonFlags: ['maxTimeMS','not allowed','IndexOptionsConflict','expireAfterSeconds','unknown field','not authorized','Unsupported','TypeMismatch','already exists'].filter(s => String(error.meta?.message).includes(s)) })); throw error; } }; return Reflect.get(target, name); } });
 const mocks = { '@/lib/db': { db: observedDb }, '@/modules/auth/actions': { currentUser: async () => actingUser }, 'next/cache': { revalidatePath() {} } };
 const actions = load('modules/dashboard/actions/index.ts', mocks);
 const project = await actions.createPlayground({ title: 'release-test-chunked-source', template: 'EXPRESS' }); projects.push(project.id);
 const route = load('app/api/playground/[id]/source/route.ts', mocks);
 global.fetch = async (input, options) => {
  const url = new URL(String(input), 'http://release-test.invalid');
  assert.equal(url.hostname, 'release-test.invalid');
  const request = new Request(url, options);
  const context = { params: Promise.resolve({ id: project.id }) };
  return request.method === 'POST' ? route.POST(request, context) : route.GET(request, context);
 };
 const client = load('modules/playground/lib/source-client.ts');
 const source = { folderName: 'test', items: [{ filename: 'source', fileExtension: 'txt', content: randomBytes(3 * 1024 * 1024).toString('base64') }] };
 const started = Date.now();
 const saved = await client.saveSource(project.id, source, null);
 const reopened = await client.loadSource(project.id, new AbortController().signal);
 assert.deepEqual(reopened.template, source); assert.equal(reopened.metadata.revision, saved.revision);
 console.log(JSON.stringify({ test: 'real MongoDB 4 MiB multi-chunk save/reopen', pass: true, elapsedMs: Date.now() - started }));
 console.log('Checking stale save');
 await assert.rejects(client.saveSource(project.id, source, null), /another tab/);
 console.log('PASS stale save');
 const copy = await actions.duplicateProjectById(project.id); projects.push(copy.id);
 assert.equal((await db.templateFile.findUnique({ where: { playgroundId: copy.id } })).content, (await db.templateFile.findUnique({ where: { playgroundId: project.id } })).content);
 console.log('PASS duplicate');
 actingUser = users[1]; await assert.rejects(client.loadSource(project.id, new AbortController().signal), /not found/); await assert.rejects(actions.deleteProjectById(project.id), /not found/);
 actingUser = users[0];
 console.log('PASS foreign ownership');
 const uploads = load('modules/playground/lib/source-upload.ts', mocks);
 const upload = await uploads.beginUpload(actingUser.id, project.id, saved.revision, uploads.CHUNK_CHARS + 1);
 console.log('Checking overlapping upload');
 await assert.rejects(uploads.beginUpload(actingUser.id, project.id, saved.revision, 1), e => e.status === 409);
 console.log('Checking chunk ordering');
 await assert.rejects(uploads.appendUpload(actingUser.id, project.id, upload.uploadId, 1, 'a'), e => e.status === 409);
 console.log('Checking incomplete upload');
 await assert.rejects(uploads.takeUpload(actingUser.id, project.id, upload.uploadId), e => e.status === 409);
 console.log('Aborting dedicated upload');
 await uploads.abortUpload(actingUser.id, project.id, upload.uploadId);
 assert.deepEqual((await client.loadSource(project.id, new AbortController().signal)).template, source);
 await actions.deleteProjectById(copy.id);
 console.log('PASS live duplicate, stale save rejection, foreign read/delete rejection, incomplete upload isolation and test-copy deletion');
} finally {
 global.fetch = originalFetch;
 for (const user of users) {
  await db.$runCommandRaw({ delete: 'SourceUpload', deletes: [{ q: { _id: user.id }, limit: 1 }] });
  await db.playground.deleteMany({ where: { id: { in: projects }, userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
 }
 await db.$disconnect(); console.log('Dedicated test records removed');
}
