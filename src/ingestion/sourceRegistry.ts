export const SOURCE_IDS = {
  mock: 'src-mock',
  statsbomb: 'src-statsbomb',
  footballData: 'src-football-data',
  openFootball: 'src-openfootball',
} as const;

export function getIngestHandler(sourceId: string): 'statsbomb' | 'football-data' | null {
  if (sourceId === SOURCE_IDS.statsbomb) return 'statsbomb';
  if (sourceId === SOURCE_IDS.footballData) return 'football-data';
  return null;
}
