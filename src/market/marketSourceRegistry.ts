import type { MarketDataAdapter } from './adapters/MarketDataAdapter';
import { ManualMarketInputAdapter } from './adapters/ManualMarketInputAdapter';
import { LicensedOddsApiAdapter } from './adapters/LicensedOddsApiAdapter';
import { CompliantPublicOddsAdapter } from './adapters/CompliantPublicOddsAdapter';

export function getMarketAdapters(env: { KV?: KVNamespace }): MarketDataAdapter[] {
  const adapters: MarketDataAdapter[] = [new ManualMarketInputAdapter()];
  adapters.push(new LicensedOddsApiAdapter('mkt-licensed', null));
  adapters.push(new CompliantPublicOddsAdapter('mkt-public'));
  return adapters;
}
