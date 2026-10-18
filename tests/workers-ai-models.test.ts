import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORKERS_AI_TEXT_MODEL } from '../src/ai/modelRouter';

/**
 * Text models Cloudflare retired on 2026-05-30, plus
 * `@cf/meta/llama-3.1-8b-instruct-fast`, which the May notice kept but the
 * current catalog and `@cloudflare/workers-types` 5.20261018 no longer include.
 */
const RETIRED_WORKERS_AI_MODELS = [
  '@cf/moonshotai/kimi-k2.5',
  '@hf/meta-llama/meta-llama-3-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/meta/llama-3-8b-instruct-awq',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.1-8b-instruct-awq',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-2-7b-chat-int8',
  '@cf/meta/llama-2-7b-chat-fp16',
  '@cf/mistral/mistral-7b-instruct-v0.1',
  '@hf/mistral/mistral-7b-instruct-v0.2',
  '@hf/google/gemma-7b-it',
  '@cf/google/gemma-3-12b-it',
  '@hf/nousresearch/hermes-2-pro-mistral-7b',
  '@cf/microsoft/phi-2',
  '@cf/defog/sqlcoder-7b-2',
  '@cf/unum/uform-gen2-qwen-500m',
  '@cf/facebook/bart-large-cnn',
] as const;

const RETIRED = new Set<string>(RETIRED_WORKERS_AI_MODELS);
const MODEL_ID = /@(?:cf|hf)\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g;

function retiredIdsIn(text: string): string[] {
  return [...text.matchAll(MODEL_ID)].map((match) => match[0]).filter((id) => RETIRED.has(id));
}

async function retiredModelHits(dir: string): Promise<string[]> {
  const hits: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...(await retiredModelHits(path)));
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|jsonc)$/.test(entry.name)) continue;
    const text = await readFile(path, 'utf8');
    for (const id of retiredIdsIn(text)) hits.push(`${path}: ${id}`);
  }
  return hits;
}

describe('Workers AI text model', () => {
  it('uses the catalog-supported 8B instruct model', () => {
    expect(WORKERS_AI_TEXT_MODEL).toBe('@cf/meta/llama-3.1-8b-instruct-fp8');
    expect(RETIRED.has(WORKERS_AI_TEXT_MODEL)).toBe(false);
  });

  it('fails on known retired model ids without flagging the supported replacement', () => {
    expect(retiredIdsIn("env.AI.run('@cf/meta/llama-3-8b-instruct', {})")).toEqual([
      '@cf/meta/llama-3-8b-instruct',
    ]);
    expect(retiredIdsIn("env.AI.run('@cf/meta/llama-3.1-8b-instruct', {})")).toEqual([
      '@cf/meta/llama-3.1-8b-instruct',
    ]);
    expect(retiredIdsIn("env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {})")).toEqual([
      '@cf/meta/llama-3.1-8b-instruct-fast',
    ]);
    expect(retiredIdsIn(`env.AI.run('${WORKERS_AI_TEXT_MODEL}', {})`)).toEqual([]);
  });

  it('fails when application source references a retired Workers AI model id', async () => {
    const root = join(import.meta.dirname, '..');
    const hits = [
      ...(await retiredModelHits(join(root, 'src'))),
      ...(await retiredModelHits(join(root, 'app'))),
    ];
    expect(hits).toEqual([]);
  });
});
