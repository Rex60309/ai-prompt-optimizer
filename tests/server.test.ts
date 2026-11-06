import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Load actual server modules without network access or Next's build step.
const require = createRequire(import.meta.url);
function load(name: string): Record<string, unknown> {
  const source = fs.readFileSync(`app/lib/${name}.ts`, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(
    (id: string) => (id === './models' ? load('models') : require(id)),
    exports,
  );
  return exports;
}
const { complete, body, text } = load('server') as {
  complete: (...args: unknown[]) => Promise<{ content: string; truncated: boolean }>;
  body: (request: Request) => Promise<unknown>;
  text: (value: unknown, name: string) => string;
};
const { MODELS } = load('models') as { MODELS: { id: string; maxOutputTokens: number }[] };

test('request parsing rejects malformed and non-object JSON', async () => {
  for (const raw of ['{', 'null', '[]'])
    await assert.rejects(body(new Request('http://localhost', { method: 'POST', body: raw })), {
      status: 400,
    });
  assert.throws(() => text('   ', 'prompt'));
});

test('provider requests use each model output limit and return answers', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options!.body as string);
    const isGroq = 'messages' in request;
    const selected = MODELS.find((m: { id: string }) => m.id === request.model);
    if (isGroq) assert.equal(request.max_completion_tokens, selected!.maxOutputTokens);
    else assert.equal(request.generationConfig.maxOutputTokens, 65536);
    return Response.json(
      isGroq
        ? { choices: [{ finish_reason: 'stop', message: { content: 'answer' } }] }
        : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'answer' }] } }] },
    );
  });
  process.env.GOOGLE_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'test-key';
  for (const model of MODELS) assert.equal((await complete('test', model.id)).content, 'answer');
});

test('blocked Gemini responses return the actual reason', async (t) => {
  process.env.GOOGLE_API_KEY = 'test-key';
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
  );
  await assert.rejects(complete('test', 'gemini-2.5-flash-lite'), (error: Error) =>
    error.message.includes('SAFETY'),
  );
});

test('partial text is retained but truncated judge JSON is rejected', async (t) => {
  process.env.GROQ_API_KEY = 'test-key';
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      choices: [{ finish_reason: 'length', message: { content: 'partial answer' } }],
    }),
  );
  const result = await complete('test', 'openai/gpt-oss-20b');
  assert.equal(result.content, 'partial answer');
  assert.equal(result.truncated, true);
  await assert.rejects(complete('test', 'openai/gpt-oss-20b', true), { status: 502 });
});

test('rate limits stop requests without fallback', async (t) => {
  process.env.GROQ_API_KEY = 'test-key';
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(complete('test', 'openai/gpt-oss-20b'), { status: 429 });
  assert.equal(mock.mock.callCount(), 1);
});

test('unknown models are rejected before network access', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('unexpected network');
  });
  await assert.rejects(complete('test', 'unsupported-model'), { status: 400 });
  assert.equal(mock.mock.callCount(), 0);
});
