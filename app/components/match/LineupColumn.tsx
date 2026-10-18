import { MatchLineupSidePanel } from './MatchLineupSidePanel';
import type { MatchPreviewAnalysis } from '../../lib/api';

export function LineupColumn({
  side,
  label,
  matchRef,
}: {
  side: MatchPreviewAnalysis['home'];
  label: string;
  matchRef?: string;
}) {
  return (
    <MatchLineupSidePanel
      side={{
        teamName: side.teamName,
        formation: side.formation,
        hasAccurateLineup: side.hasAccurateLineup,
        hasLineup: (side.fullLineup?.length ?? 0) >= 7,
        source: side.lineupSource,
        players: side.fullLineup ?? [],
        lineupPlayers: side.lineupPlayers,
        starters: side.lineupPlayers,
      }}
      label={label}
      matchRef={matchRef}
      compact
    />
  );
}
