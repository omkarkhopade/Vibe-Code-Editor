import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export default function loadTs(file, mocks = {}, cache = new Map()) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const loaded = { exports: {} }; cache.set(absolute, loaded);
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(absolute), name);
      const found = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (found) return loadTs(found, mocks, cache);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports);
  return loaded.exports;
};
