import type { AppEnv } from '../../env';
import { calculateModelVsMarketDelta } from '../calculations/modelVsMarket';
import { MARKET_DISCLAIMER, type ModelVsMarketResult } from '../types';
import * as marketRepo from '../../db/repositories/marketRepo';
import * as probabilityRepo from '../../db/repositories/probabilityRepo';

function consensusFromOdds(rows: Record<string, unknown>[]) {
  const latest = new Map<string, number>();
  for (const r of rows) {
    const sel = String(r.selection);
    latest.set(sel, Number(r.normalized_probability));
  }
  return {
    home: latest.get('home') ?? 0.33,
    draw: latest.get('draw') ?? 0.33,
    away: latest.get('away') ?? 0.34,
  };
}

export async function buildModelVsMarket(env: AppEnv, matchId: string): Promise<ModelVsMarketResult | null> {
  const snap = await probabilityRepo.getLatestSnapshot(env.DB, matchId);
  if (!snap) return null;

  const odds = await marketRepo.getLatestMarketOdds(env.DB, matchId);
  if (!odds.length) return null;
  const latestOdds = odds[0];

  const model = {
    home: snap.home_win_prob,
    draw: snap.draw_prob,
    away: snap.away_win_prob,
  };
  const market = consensusFromOdds(odds);
  const edge = calculateModelVsMarketDelta({ model, market });

  const volatility = Math.min(
    1,
    (Math.abs(edge.home) + Math.abs(edge.draw) + Math.abs(edge.away)) / 2,
  );

  const source = await env.DB.prepare('SELECT * FROM market_sources WHERE id = ?')
    .bind(String(latestOdds.source_id ?? 'mkt-manual'))
    .first<{ name: string; reliability_score: number }>();

  await marketRepo.saveMarketSignalAnalysis(env.DB, matchId, {
    model,
    market,
    edge,
    volatilityScore: volatility,
    explanationJson: JSON.stringify({ disclaimer: MARKET_DISCLAIMER }),
  });

  return {
    matchId,
    model,
    market,
    edge,
    volatilityScore: volatility,
    sourceId: String(latestOdds.source_id ?? 'mkt-manual'),
    sourceName: source?.name ?? 'Market source',
    sourceReliability: source?.reliability_score ?? 0.5,
    retrievedAt: String(latestOdds.retrieved_at ?? null),
    disclaimer: MARKET_DISCLAIMER,
  };
}

export async function getMarketSignalsPayload(env: AppEnv, matchId: string) {
  const latest = await marketRepo.getLatestMarketSignal(env.DB, matchId);
  const odds = await marketRepo.getLatestMarketOdds(env.DB, matchId);
  const built = latest
    ? {
        matchId,
        model: {
          home: Number(latest.model_home_prob),
          draw: Number(latest.model_draw_prob),
          away: Number(latest.model_away_prob),
        },
        market: {
          home: Number(latest.market_home_prob),
          draw: Number(latest.market_draw_prob),
          away: Number(latest.market_away_prob),
        },
        edge: {
          home: Number(latest.edge_home),
          draw: Number(latest.edge_draw),
          away: Number(latest.edge_away),
        },
        volatilityScore: Number(latest.volatility_score),
        disclaimer: MARKET_DISCLAIMER,
        updatedAt: String(latest.created_at),
      }
    : await buildModelVsMarket(env, matchId);

  return { signals: built, oddsSnapshots: odds, disclaimer: MARKET_DISCLAIMER };
}
