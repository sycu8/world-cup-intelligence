import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.unmock('../src/ingestion/fifa/fifaLiveSync');
vi.unmock('../src/ingestion/fifa/fifaLiveBlogSync');
vi.unmock('../src/ingestion/espn/espnStatsClient');
vi.unmock('../src/ingestion/fifa/fifaGamedayClient');
vi.unmock('../src/models/probability/explainFactors');
vi.unmock('../src/services/matchHistory');
vi.unmock('../src/services/matchLineupProjection');
vi.unmock('../src/services/matchScenarioService');
vi.unmock('../src/services/matchStats');
vi.unmock('../src/services/pitchMap');
vi.unmock('../src/models/scenarios/scenarioRealtimeUpdater');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
