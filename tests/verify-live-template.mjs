// Explicit read-only diagnostic; never run automatically in CI.
import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import load from './load-ts.mjs';
nextEnv.loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const db = new PrismaClient();
const id = process.argv[2];
if (!/^c[a-z0-9]{24}$/.test(id || '')) throw new Error('Pass a valid playground ID');
try {
  const record = await db.playground.findUnique({ where: { id }, select: { userId: true, template: true } });
  if (!record) throw new Error('Playground not found');
  // Session boundary is stubbed. This does not verify OAuth or browser authentication.
  const mocks = { '@/lib/db': { db }, '@/modules/auth/actions': { currentUser: async () => ({ id: record.userId }) } };
  if (process.argv.includes('--baseline')) {
    const source = execFileSync('git', ['show', 'HEAD:app/api/template/[id]/route.ts'], { encoding: 'utf8' });
    const baselinePaths = execFileSync('git', ['show', 'HEAD:lib/template.ts'], { encoding: 'utf8' });
    function evaluate(code, imports) {
      const loaded = { exports: {} };
      new Function('require', 'module', 'exports', ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)(name => imports[name] ?? require(name), loaded, loaded.exports);
      return loaded.exports;
    }
    const original = evaluate(source, { ...mocks, '@/lib/template': evaluate(baselinePaths, {}), '@/modules/playground/lib/path-to-json': load('modules/playground/lib/path-to-json.ts') });
    const baseline = await original.GET(new Request('http://localhost/api/template/' + id), { params: Promise.resolve({ id }) });
    console.log(JSON.stringify({ check: 'baseline', status: baseline.status, template: record.template }));
    if (baseline.status !== 500) throw new Error('Expected baseline failure was not reproduced');
  }
  const { GET } = load('app/api/template/[id]/route.ts', mocks);
  const response = await GET(new Request('http://localhost/api/template/' + id), { params: Promise.resolve({ id }) });
  const body = await response.json();
  console.log(JSON.stringify({ check: 'corrected', status: response.status, template: record.template, validStructure: load('modules/playground/lib/validation.ts').isTemplateFolder(body.templateJson) }));
  if (response.status !== 200) process.exitCode = 1;
} catch (error) { console.log(JSON.stringify({ error: error instanceof Error ? error.name : 'UnknownError' })); process.exitCode = 1; }
finally { await db.$disconnect(); }

