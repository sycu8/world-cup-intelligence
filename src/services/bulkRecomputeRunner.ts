import type { AppEnv } from '../env';
import {
  BULK_BUDGET_SKIPS_KEY,
  BULK_RECOMPUTE_CURSOR_KEY,
  BULK_RECOMPUTE_KV_KEY,
  LAST_RECOMPUTE_META_KEY,
} from '../constants/pipeline';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { recomputeMatchProbability } from './recomputeMatch';
import { refreshChampionOdds } from './tournamentChampionOdds';
import { logError, logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';

export type RecomputeScheduleOptions = {
  /** Queue the walk now. Does not run a chunk in this invocation. */
  immediate?: boolean;
  /** Enqueue the walk when a queue is bound. */
  queue?: boolean;
};

export type BulkRecomputeRunOptions = {
  /** Last match id already finished. Absent means start from the saved cursor, or the first match. */
  cursor?: string;
  phase?: 'matches' | 'champion';
  budgetMs?: number;
  now?: () => number;
  /** Kept on every continuation. A cleared flag is not rewritten with a new reason. */
  reason?: string;
  /** Continuation must match the current walk or it drops. */
  walkId?: string;
};

export type BulkWalk = {
  walkId?: string;
  reason: string;
  cursor?: string;
  leaseUntil?: number;
  leaseToken?: string;
  /** Epoch ms of the last cursor move, schedule, or resume. */
  progressAt?: number;
  /** How many times the budget cut each match in this walk. */
  budgetCuts?: Record<string, number>;
};

export function readBulkPending(raw: string | null): BulkWalk | null {
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as BulkWalk;
      if (typeof parsed.reason === 'string' && parsed.reason) {
        return {
          walkId: typeof parsed.walkId === 'string' ? parsed.walkId : undefined,
          reason: parsed.reason,
          cursor: typeof parsed.cursor === 'string' ? parsed.cursor : undefined,
          leaseUntil: typeof parsed.leaseUntil === 'number' ? parsed.leaseUntil : undefined,
          leaseToken: typeof parsed.leaseToken === 'string' ? parsed.leaseToken : undefined,
          progressAt: typeof parsed.progressAt === 'number' ? parsed.progressAt : undefined,
          budgetCuts: readBudgetCuts(parsed.budgetCuts),
        };
      }
    } catch {
      /* A plain source string is a fresh schedule. */
    }
  }
  return { reason: raw };
}

function readBudgetCuts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const cuts: Record<string, number> = {};
  for (const [matchId, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === 'number' && count > 0) cuts[matchId] = count;
  }
  return Object.keys(cuts).length ? cuts : undefined;
}

/** True when a walk record exists. */
export async function isBulkWalkPending(env: AppEnv): Promise<boolean> {
  return readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY)) != null;
}

/** Live recompute waits only while a chunk holds the lease. A stored walk with an expired lease does not block it. */
export function bulkWalkLeaseIsActive(walk: BulkWalk | null, now = Date.now()): boolean {
  return (walk?.leaseUntil ?? 0) > now;
}

export async function isBulkWalkLeaseActive(env: AppEnv, now = Date.now()): Promise<boolean> {
  return bulkWalkLeaseIsActive(readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY)), now);
}

/**
 * Stay under the 15-minute queue consumer limit, and under the 2-minute
 * briefing wait. At most this many matches per message, and never past the
 * time budget. The next message carries the cursor.
 */
export const BULK_RECOMPUTE_CHUNK_SIZE = 8;
export const BULK_RECOMPUTE_BUDGET_MS = 60_000;
/** Covers one chunk budget plus the time to ack and enqueue the continuation. */
export const BULK_RECOMPUTE_LEASE_MS = 90_000;
/** The second budget cut on one match skips it so the walk can finish. */
export const BULK_BUDGET_CUTS_BEFORE_SKIP = 2;
/** Lease expired and no cursor progress for this long: the cron re-sends the same walk. */
export const BULK_WALK_STALL_MS = 10 * 60_000;

export type BulkChunkResult = {
  done: boolean;
  processed: number;
  nextCursor?: string;
  /** The walk was replaced or the flag was cleared. Do not enqueue or rewrite it. */
  dropped?: boolean;
};

type ClaimResult = { walk: BulkWalk; deferSeconds?: number };

function resumeIndex(ids: string[], cursors: Array<string | null | undefined>): number {
  let furthest = -1;
  for (const cursor of cursors) {
    if (!cursor) continue;
    const index = ids.indexOf(cursor);
    if (index > furthest) furthest = index;
  }
  return furthest < 0 ? 0 : furthest + 1;
}

function awaitWithin<T>(work: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(new Error('bulk recompute budget exhausted'));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('bulk recompute budget exhausted')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function budgetExhausted(error: unknown): boolean {
  return error instanceof Error && error.message === 'bulk recompute budget exhausted';
}

async function listWc2026MatchIds(env: AppEnv): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM matches WHERE tournament_id = ? ORDER BY kickoff_utc ASC, id ASC`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<{ id: string }>();
  return (results ?? []).map((row) => row.id);
}

async function loadWalk(env: AppEnv): Promise<BulkWalk | null> {
  return readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY));
}

async function saveWalk(env: AppEnv, walk: BulkWalk): Promise<void> {
  await env.KV.put(BULK_RECOMPUTE_KV_KEY, JSON.stringify(walk), { expirationTtl: 86400 });
}

/**
 * One worker holds the lease. A second delivery of the same walk waits out
 * the lease via a delayed message instead of starting another chunk.
 * Compare-and-set on leaseToken because KV writes are not transactional.
 */
async function claimWalk(env: AppEnv, walkId: string | undefined, now: number): Promise<ClaimResult | null> {
  const pending = await loadWalk(env);
  if (!pending) return null;
  if (walkId && pending.walkId !== walkId) return null;
  if (!walkId && pending.walkId) return null;
  if (!pending.walkId) return { walk: pending };
  if ((pending.leaseUntil ?? 0) > now) {
    const deferSeconds = Math.max(1, Math.ceil((pending.leaseUntil! - now) / 1000));
    return { walk: pending, deferSeconds };
  }
  const token = crypto.randomUUID();
  const next: BulkWalk = {
    ...pending,
    leaseUntil: now + BULK_RECOMPUTE_LEASE_MS,
    leaseToken: token,
  };
  await saveWalk(env, next);
  const confirmed = await loadWalk(env);
  if (!confirmed || confirmed.walkId !== walkId || confirmed.leaseToken !== token) return null;
  return { walk: confirmed };
}

async function releaseLease(env: AppEnv, walk: BulkWalk): Promise<void> {
  if (!walk.walkId || !walk.leaseToken) return;
  const current = await loadWalk(env);
  if (!current || current.walkId !== walk.walkId || current.leaseToken !== walk.leaseToken) return;
  const next: BulkWalk = { ...current, leaseUntil: 0 };
  delete next.leaseToken;
  await saveWalk(env, next);
}

async function persistCursor(env: AppEnv, walk: BulkWalk, cursor: string): Promise<boolean> {
  const current = await loadWalk(env);
  if (!current) return false;
  if (walk.walkId && current.walkId !== walk.walkId) return false;
  if (!walk.walkId && current.walkId) return false;
  if (walk.leaseToken && current.leaseToken !== walk.leaseToken) return false;
  await saveWalk(env, { ...current, cursor, reason: current.reason, progressAt: Date.now() });
  await env.KV.put(BULK_RECOMPUTE_CURSOR_KEY, cursor, { expirationTtl: 86400 });
  return true;
}

async function recordBudgetCut(env: AppEnv, walk: BulkWalk, matchId: string): Promise<number | null> {
  const current = await loadWalk(env);
  if (!current) return null;
  if (walk.walkId && current.walkId !== walk.walkId) return null;
  if (!walk.walkId && current.walkId) return null;
  if (walk.leaseToken && current.leaseToken !== walk.leaseToken) return null;
  const cuts = { ...(current.budgetCuts ?? {}) };
  const next = (cuts[matchId] ?? 0) + 1;
  cuts[matchId] = next;
  await saveWalk(env, { ...current, budgetCuts: cuts, progressAt: Date.now() });
  return next;
}

async function incrementBudgetSkips(env: AppEnv): Promise<void> {
  try {
    const raw = await env.KV.get(BULK_BUDGET_SKIPS_KEY);
    const base = Number.parseInt(raw ?? '0', 10);
    await env.KV.put(BULK_BUDGET_SKIPS_KEY, String((Number.isFinite(base) ? base : 0) + 1));
  } catch (error) {
    logError('bulk budget skip count failed', { error: String(error) });
  }
}

async function clearWalk(env: AppEnv, walk: BulkWalk): Promise<boolean> {
  const current = await loadWalk(env);
  if (!current) return false;
  if (walk.walkId && current.walkId !== walk.walkId) return false;
  if (!walk.walkId && current.walkId) return false;
  await env.KV.delete(BULK_RECOMPUTE_KV_KEY);
  await env.KV.delete(BULK_RECOMPUTE_CURSOR_KEY);
  return true;
}

/**
 * Recompute matches until the chunk size or the budget is spent.
 * A match still running when the budget ends is left as the next start.
 * The cursor is the last match that finished.
 */
export async function runWc2026BulkChunk(
  env: AppEnv,
  options: BulkRecomputeRunOptions & { walk: BulkWalk },
): Promise<BulkChunkResult> {
  const budgetMs = options.budgetMs ?? BULK_RECOMPUTE_BUDGET_MS;
  const now = options.now ?? Date.now;
  const started = now();
  const ids = await listWc2026MatchIds(env);
  const saved = await env.KV.get(BULK_RECOMPUTE_CURSOR_KEY);
  let index = resumeIndex(ids, [options.cursor, saved, options.walk.cursor]);
  let processed = 0;
  let last = index > 0 ? ids[index - 1] : undefined;

  while (index < ids.length && processed < BULK_RECOMPUTE_CHUNK_SIZE) {
    const elapsed = now() - started;
    if (elapsed >= budgetMs) break;
    const matchId = ids[index]!;
    const outcome = recomputeMatchProbability(env, matchId).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    try {
      const result = await awaitWithin(outcome, budgetMs - elapsed);
      if (!result.ok) {
        logError('recompute failed', { match_id: matchId, error: String(result.error) });
      }
    } catch (error) {
      if (budgetExhausted(error)) {
        const cuts = await recordBudgetCut(env, options.walk, matchId);
        if (cuts == null) return { done: false, processed, nextCursor: last, dropped: true };
        if (cuts >= BULK_BUDGET_CUTS_BEFORE_SKIP) {
          logInfo('bulk recompute match skipped', { match_id: matchId, cuts });
          await incrementBudgetSkips(env);
          const wrote = await persistCursor(env, options.walk, matchId);
          if (!wrote) return { done: false, processed, nextCursor: last, dropped: true };
          last = matchId;
          processed += 1;
          index += 1;
        } else {
          logError('recompute failed', { match_id: matchId, error: String(error), cuts });
        }
        break;
      }
      throw error;
    }
    const wrote = await persistCursor(env, options.walk, matchId);
    if (!wrote) return { done: false, processed, nextCursor: last, dropped: true };
    last = matchId;
    processed += 1;
    index += 1;
  }

  const done = index >= ids.length;
  return { done, processed, nextCursor: done ? undefined : last };
}

async function enqueueBulk(
  env: AppEnv,
  body: { reason?: string; cursor?: string; phase?: 'matches' | 'champion'; walkId?: string },
  delaySeconds?: number,
): Promise<void> {
  if (!env.MODEL_QUEUE) {
    logInfo('bulk wc2026 recompute paused', {
      reason: body.reason,
      cursor: body.cursor,
      phase: body.phase,
      walkId: body.walkId,
    });
    return;
  }
  const message = {
    type: 'recompute_wc2026_bulk' as const,
    reason: body.reason,
    ...(body.walkId ? { walkId: body.walkId } : {}),
    ...(body.cursor ? { cursor: body.cursor } : {}),
    ...(body.phase ? { phase: body.phase } : {}),
  };
  if (delaySeconds != null) await env.MODEL_QUEUE.send(message, { delaySeconds });
  else await env.MODEL_QUEUE.send(message);
}

/** Run one bulk slice if this message still owns the walk. A chunk error propagates. */
export async function runBulkRecomputeIfPending(
  env: AppEnv,
  options: BulkRecomputeRunOptions = {},
): Promise<boolean> {
  const now = options.now ?? Date.now;

  if (options.phase === 'champion') {
    const pending = await loadWalk(env);
    if (options.walkId && pending?.walkId && pending.walkId !== options.walkId) {
      logInfo('bulk wc2026 recompute dropped', { walkId: options.walkId, phase: 'champion' });
      return false;
    }
    try {
      await awaitWithin(refreshChampionOdds(env), options.budgetMs ?? BULK_RECOMPUTE_BUDGET_MS);
      logInfo('champion odds refreshed after bulk recompute', { reason: options.reason });
    } catch (err) {
      logInfo('champion odds refresh failed after bulk recompute', { error: String(err) });
    }
    return true;
  }

  const pending = await loadWalk(env);
  if (!pending) return false;
  if (pending.walkId && options.walkId !== pending.walkId) {
    logInfo('bulk wc2026 recompute dropped', { walkId: options.walkId, current: pending.walkId });
    return false;
  }
  if (!pending.walkId && options.walkId) {
    logInfo('bulk wc2026 recompute dropped', { walkId: options.walkId });
    return false;
  }

  const claimed = await claimWalk(env, pending.walkId, now());
  if (!claimed) {
    logInfo('bulk wc2026 recompute dropped', { walkId: options.walkId ?? pending.walkId, reason: 'lease' });
    return false;
  }
  if (claimed.deferSeconds) {
    await enqueueBulk(
      env,
      {
        reason: options.reason || claimed.walk.reason,
        cursor: options.cursor ?? claimed.walk.cursor,
        walkId: claimed.walk.walkId,
      },
      claimed.deferSeconds,
    );
    logInfo('bulk wc2026 recompute deferred', { walkId: claimed.walk.walkId, delaySeconds: claimed.deferSeconds });
    return true;
  }

  const reason = options.reason || claimed.walk.reason;
  let chunk: BulkChunkResult;
  try {
    chunk = await runWc2026BulkChunk(env, {
      ...options,
      reason,
      cursor: options.cursor ?? claimed.walk.cursor,
      walk: claimed.walk,
    });
  } finally {
    await releaseLease(env, claimed.walk);
  }

  if (chunk.dropped) return false;
  const still = await loadWalk(env);
  if (!still || (claimed.walk.walkId && still.walkId !== claimed.walk.walkId)) return false;
  if (!claimed.walk.walkId && still.walkId) return false;

  if (!chunk.done) {
    await enqueueBulk(env, { reason, cursor: chunk.nextCursor, walkId: claimed.walk.walkId });
    logInfo('bulk wc2026 recompute continued', {
      reason,
      walkId: claimed.walk.walkId,
      processed: chunk.processed,
      cursor: chunk.nextCursor,
    });
    return true;
  }

  const cleared = await clearWalk(env, claimed.walk);
  if (!cleared) return false;
  await env.KV.put(LAST_RECOMPUTE_META_KEY, nowIso(), { expirationTtl: 86400 * 7 });
  logInfo('bulk wc2026 recompute finished', { reason, walkId: claimed.walk.walkId, processed: chunk.processed });
  if (env.MODEL_QUEUE) {
    await enqueueBulk(env, { reason, phase: 'champion', walkId: claimed.walk.walkId });
    return true;
  }
  try {
    await refreshChampionOdds(env);
    logInfo('champion odds refreshed after bulk recompute', { reason });
  } catch (err) {
    logInfo('champion odds refresh failed after bulk recompute', { reason, error: String(err) });
  }
  return true;
}

/**
 * Mark probabilities stale after reference/live data changes.
 * Always starts a new walk at the first match and queues one starter.
 * Does not run a chunk here, even when `immediate` is set.
 */
export async function scheduleRecomputeAfterDataChange(
  env: AppEnv,
  source: string,
  options: RecomputeScheduleOptions = {},
): Promise<void> {
  const { immediate = false, queue = true } = options;
  const walkId = crypto.randomUUID();

  await env.KV.delete(BULK_RECOMPUTE_CURSOR_KEY);
  await saveWalk(env, { walkId, reason: source, leaseUntil: 0, progressAt: Date.now() });
  await env.KV.put(LAST_RECOMPUTE_META_KEY, nowIso(), { expirationTtl: 86400 * 7 });
  logInfo('wc2026 recompute scheduled', { source, walkId, immediate, queue });

  if ((immediate || queue) && env.MODEL_QUEUE) {
    await enqueueBulk(env, { reason: source, walkId });
  }
}

/**
 * A walk whose lease has expired and whose cursor has not moved for
 * `BULK_WALK_STALL_MS` gets one continuation, same walk id, from the last finished match.
 */
export async function resumeStalledBulkWalk(env: AppEnv, now = Date.now()): Promise<boolean> {
  const walk = await loadWalk(env);
  if (!walk?.walkId) return false;
  if (bulkWalkLeaseIsActive(walk, now)) return false;
  const progressAt = walk.progressAt ?? 0;
  if (now - progressAt < BULK_WALK_STALL_MS) return false;
  await enqueueBulk(env, { reason: walk.reason, cursor: walk.cursor, walkId: walk.walkId });
  await saveWalk(env, { ...walk, leaseUntil: 0, progressAt: now });
  logInfo('bulk wc2026 recompute resumed', { walkId: walk.walkId, cursor: walk.cursor, reason: walk.reason });
  return true;
}
