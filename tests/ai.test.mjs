import { test } from 'node:test';
import assert from 'node:assert/strict';
import load from './load-ts.mjs';
test('Ollama checks availability, sends bounded options and preserves response text', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push([url, options]); return Response.json(url.endsWith('/api/tags') ? { models: [{ name: 'gpt-oss:20b' }] } : { response: ' OK ' }); });
  const { generateText } = load('modules/ai/lib/ollama.ts');
  assert.equal(await generateText('test', new AbortController().signal), 'OK');
  const body = JSON.parse(calls[1][1].body);
  assert.equal(body.model, 'gpt-oss:20b'); assert.equal(body.options.num_predict, 1024); assert.equal(body.options.num_ctx, 4096); assert.equal(body.stream, false);
});
test('missing model, unavailable service and empty responses are controlled', async t => {
  const provider = load('modules/ai/lib/ollama.ts');
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ models: [] }));
  await assert.rejects(provider.generateText('test', new AbortController().signal), error => error.status === 503);
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('private endpoint'); });
  await assert.rejects(provider.generateText('test', new AbortController().signal), error => error.status === 503 && !error.message.includes('private'));
  fetchMock.mock.mockImplementation(async url => Response.json(url.endsWith('/api/tags') ? { models: [{ name: 'gpt-oss:20b' }] } : { response: '' }));
  await assert.rejects(provider.generateText('test', new AbortController().signal), error => error.status === 502);
});
test('concurrent inference is rejected and cancellation releases capacity', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((_, reject) => { if (signal.aborted) reject(signal.reason); else signal.addEventListener('abort', () => reject(signal.reason), { once: true }); }));
  const provider = load('modules/ai/lib/ollama.ts'); const controller = new AbortController();
  const first = provider.generateText('test', controller.signal);
  await assert.rejects(provider.generateText('duplicate', new AbortController().signal), error => error.status === 429);
  controller.abort(); await assert.rejects(first, error => error.status === 499);
  const second = new AbortController(); second.abort();
  await assert.rejects(provider.generateText('test', second.signal), error => error.status === 499);
});
test('AI request parsing rejects cross-origin, oversized, malformed and anonymous requests', async () => {
  const request = (body, headers = {}) => new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  const { readAIRequest } = load('modules/ai/lib/request.ts', { '@/modules/auth/actions': { currentUser: async () => ({ id: 'owner' }) } });
  await assert.rejects(readAIRequest(request('{}', { origin: 'https://foreign.example' })), error => error.status === 403);
  await assert.rejects(readAIRequest(request('broken')), error => error.status === 400);
  await assert.rejects(readAIRequest(request('x'.repeat(128 * 1024 + 1))), error => error.status === 413);
  assert.deepEqual(await readAIRequest(request('{"message":"hello"}')), { message: 'hello' });
  const anonymous = load('modules/ai/lib/request.ts', { '@/modules/auth/actions': { currentUser: async () => null } });
  await assert.rejects(anonymous.readAIRequest(request('{}')), error => error.status === 401);
});

test('NDJSON parsing handles split UTF-8, multiple records and missing final newline', async () => {
  const { readNDJSON } = load('modules/ai/lib/ndjson.ts');
  const encoded = new TextEncoder().encode('{"token":"\u03bb"}\n{"done":true}');
  const received = [];
  await readNDJSON(new ReadableStream({ start(controller) { for (const byte of encoded) controller.enqueue(new Uint8Array([byte])); controller.close(); } }), value => received.push(value));
  assert.deepEqual(received, [{ token: '\u03bb' }, { done: true }]);
  await assert.rejects(readNDJSON(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('invalid')); controller.close(); } }), () => {}));
});
test('streaming forwards only response tokens and checks completion', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async url => url.endsWith('/api/tags') ? Response.json({ models: [{ name: 'gpt-oss:20b' }] }) : new Response('{"thinking":"private reasoning","response":"OK"}\n{"done":true}\n'));
  const { generateText } = load('modules/ai/lib/ollama.ts');
  const tokens = [];
  assert.equal(await generateText('test', new AbortController().signal, undefined, token => tokens.push(token)), 'OK');
  assert.deepEqual(tokens, ['OK']);
  mock.mock.mockImplementation(async url => url.endsWith('/api/tags') ? Response.json({ models: [{ name: 'gpt-oss:20b' }] }) : new Response('{"response":"unfinished"}\n'));
  await assert.rejects(generateText('test', new AbortController().signal, undefined, () => {}), error => error.status === 502);
});

test('model discovery is deduplicated and selected installed models reach inference', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'gpt-oss:20b' }, { name: 'coder:latest' }, { name: 'coder:latest' }] });
    sent = JSON.parse(options.body); return Response.json({ response: 'code' });
  });
  const provider = load('modules/ai/lib/ollama.ts');
  assert.deepEqual((await provider.listModels(new AbortController().signal)).models, ['coder:latest', 'gpt-oss:20b']);
  await provider.generateText('test', new AbortController().signal, undefined, undefined, 'coder:latest');
  assert.equal(sent.model, 'coder:latest'); assert.equal(sent.think, undefined);
  await assert.rejects(provider.generateText('test', new AbortController().signal, undefined, undefined, 'uninstalled:model'), error => error.status === 400);
});
test('completion sends a separate system prompt and preserves insertion whitespace', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'gpt-oss:20b' }] });
    sent = JSON.parse(options.body); return Response.json({ response: '\n  return value;\n' });
  });
  const { generateText } = load('modules/ai/lib/ollama.ts');
  const { COMPLETION_SYSTEM_PROMPT } = load('modules/ai/lib/prompts.ts');
  const result = await generateText('prefix/suffix', new AbortController().signal, COMPLETION_SYSTEM_PROMPT, undefined, undefined, true);
  assert.equal(result, '\n  return value;\n');
  assert.equal(sent.system, COMPLETION_SYSTEM_PROMPT); assert.match(sent.system, /untrusted/); assert.match(sent.system, /do not repeat/);
});
test('model catalog endpoint requires authentication and reveals no internal endpoint', async () => {
  const mocks = { '@/modules/auth/actions': { currentUser: async () => ({ id: 'owner' }) }, '@/modules/ai/lib/ollama': { listModels: async () => ({ defaultModel: 'gpt-oss:20b', models: ['gpt-oss:20b'] }) } };
  const { GET } = load('app/api/ai/models/route.ts', mocks);
  const response = await GET(new Request('http://localhost/api/ai/models'));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { defaultModel: 'gpt-oss:20b', models: ['gpt-oss:20b'] });
  const anonymous = load('app/api/ai/models/route.ts', { ...mocks, '@/modules/auth/actions': { currentUser: async () => null } });
  assert.equal((await anonymous.GET(new Request('http://localhost/api/ai/models'))).status, 401);
});
