import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type PlayerSummary } from '../lib/api';
import { useI18n } from '../lib/i18n/I18nContext';

export function PlayerPage() {
  const { playerId } = useParams();
  const { t } = useI18n();
  const [player, setPlayer] = useState<PlayerSummary | null>(null);

  useEffect(() => {
    if (playerId) api.player(playerId).then((r) => setPlayer(r.data));
  }, [playerId]);

  if (!player) return <div className="text-muted">{t('common.loading')}</div>;

  return (
    <div className="panel max-w-xl">
      <h1 className="text-2xl font-bold">{player.name}</h1>
      <p className="text-muted">
        {player.position} · {player.club}
      </p>
    </div>
  );
}
