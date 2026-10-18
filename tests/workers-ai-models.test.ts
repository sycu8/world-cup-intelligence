import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolveModel, WORKERS_AI_BRIEFING_MAX_TOKENS, WORKERS_AI_TEXT_MODEL } from '../src/ai/modelRouter';
import { translateMatchRecapText } from '../src/ai/translateMatchRecap';
import { createMockEnv } from './helpers/mockEnv';

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

const TEXT_GENERATION_FILES = [
  'src/ai/tacticalBriefing.ts',
  'src/ai/entityExtraction.ts',
  'src/ai/translateNews.ts',
  'src/ai/translateMatchRecap.ts',
];

function textGenerationCallsMissingMaxTokens(source: string): number {
  let missing = 0;
  let index = 0;
  while ((index = source.indexOf('env.AI.run(', index)) !== -1) {
    const window = source.slice(index, index + 280);
    index += 'env.AI.run('.length;
    if (window.includes('m2m100')) continue;
    if (!window.includes('max_tokens')) missing += 1;
  }
  return missing;
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

  it('sets max_tokens on every direct text-generation call', async () => {
    const root = join(import.meta.dirname, '..');
    const misses: string[] = [];
    for (const rel of TEXT_GENERATION_FILES) {
      const text = await readFile(join(root, rel), 'utf8');
      const missing = textGenerationCallsMissingMaxTokens(text);
      if (missing > 0) misses.push(`${rel}: ${missing}`);
    }
    expect(misses).toEqual([]);
    expect(WORKERS_AI_BRIEFING_MAX_TOKENS).toBeGreaterThanOrEqual(800);
    expect(WORKERS_AI_BRIEFING_MAX_TOKENS).toBeLessThanOrEqual(1200);
    expect(WORKERS_AI_BRIEFING_MAX_TOKENS).not.toBe(resolveModel('tactical_briefing').maxTokens);
    expect(resolveModel('entity_extract').maxTokens).toBeGreaterThan(256);
    expect(resolveModel('news_summary').maxTokens).toBeGreaterThan(256);
  });

  it('passes max_tokens when translating a match recap line', async () => {
    const run = vi.fn(async () => ({ response: '{"textVi":"Đội tuyển mở tỷ số."}' }));
    const env = createMockEnv({ AI: { run } as never });
    const result = await translateMatchRecapText(env, 'The team scores.');
    expect(result).toContain('Đội');
    expect(run).toHaveBeenCalledWith(
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      expect.objectContaining({ max_tokens: resolveModel('news_summary').maxTokens }),
    );
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
