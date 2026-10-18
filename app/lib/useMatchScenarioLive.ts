import { useEffect, useRef } from 'react';
import type { MatchScenarioSet } from './api';

function liveWebSocketUrl(matchRef: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/matches/${encodeURIComponent(matchRef)}/live`;
}

/** Subscribe to MatchRoom SCENARIO_UPDATE pushes for a match. */
export function useMatchScenarioLive(
  matchRef: string | undefined,
  onUpdate: (data: MatchScenarioSet) => void,
  enabled = true,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!matchRef || !enabled) return;

    let closed = false;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryMs = 2000;

    const connect = () => {
      ws = new WebSocket(liveWebSocketUrl(matchRef));

      ws.onopen = () => {
        retryMs = 2000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            payload?: MatchScenarioSet;
          };
          if (msg.type === 'SCENARIO_UPDATE' && msg.payload?.scenarios) {
            onUpdateRef.current(msg.payload);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (closed) return;
        retryTimer = setTimeout(() => {
          retryMs = Math.min(retryMs * 1.5, 30_000);
          connect();
        }, retryMs);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [matchRef, enabled]);
}
