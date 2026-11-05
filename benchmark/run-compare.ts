// Run: node --experimental-strip-types benchmark/run-compare.ts
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const datasetPath = process.env.DATASET || 'benchmark/test-dataset.json';
const strategy = process.env.STRATEGY || 'role-play';
const model = 'gemini-2.5-flash-lite';
const base = process.env.API_URL || 'http://localhost:3100/api';
const raw = fs.readFileSync(datasetPath, 'utf8');
const dataset = JSON.parse(raw) as { id: string; category: string; prompt: string }[];
const config = {
  version: '3.0.0',
  strategy,
  model,
  datasetHash: createHash('sha256').update(raw).digest('hex'),
  maxIterations: 2,
  temperature: 0.2,
};
const runId = createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12);
fs.mkdirSync('benchmark/results', { recursive: true });
const output = path.join('benchmark/results', `v3-${runId}.jsonl`);
const completed = new Set(
  fs.existsSync(output)
    ? fs
        .readFileSync(output, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => (JSON.parse(line) as { id: string }).id)
    : [],
);
async function call(endpoint: string, data: object): Promise<Record<string, unknown>> {
  const response = await fetch(`${base}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(70000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.error}`);
  await new Promise((resolve) => setTimeout(resolve, 4500));
  return result;
}
for (const item of dataset) {
  if (completed.has(item.id)) continue;
  const rounds: object[] = [];
  try {
    const baseline = await call('generate', { prompt: item.prompt, model });
    let previousPrompt = '',
      feedback = '';
    for (let iteration = 0; iteration <= config.maxIterations; iteration++) {
      const optimized = await call('optimize', {
        prompt: item.prompt,
        model,
        strategy,
        ...(iteration ? { previousPrompt, feedback } : {}),
      });
      const generated = await call('generate', { prompt: optimized.optimizedPrompt, model });
      const evaluation = await call('judge', {
        originalPrompt: item.prompt,
        outputA: baseline.generatedContent,
        outputB: generated.generatedContent,
        model,
      });
      const criteria = evaluation.criteria as { scoreA: number; scoreB: number }[];
      const margin = criteria.reduce((sum, c) => sum + c.scoreB - c.scoreA, 0);
      rounds.push({ iteration, optimized, generated, evaluation, margin });
      if (margin >= 0) break;
      previousPrompt = optimized.optimizedPrompt as string;
      feedback = evaluation.weaknesses as string;
      if (!feedback) break;
    }
    fs.appendFileSync(
      output,
      JSON.stringify({ ...item, config, timestamp: new Date().toISOString(), baseline, rounds }) +
        '\n',
    );
    console.log(`Saved ${item.id}`);
  } catch (error) {
    fs.appendFileSync(
      `${output}.errors`,
      JSON.stringify({
        id: item.id,
        config,
        rounds,
        error: String(error),
        timestamp: new Date().toISOString(),
      }) + '\n',
    );
    console.error(
      'Stopped; completed items are preserved. Resolve the API error before resuming.',
      String(error),
    );
    process.exitCode = 1;
    break;
  }
}
