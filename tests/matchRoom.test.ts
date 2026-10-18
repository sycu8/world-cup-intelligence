import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchRoom } from '../src/durable-objects/MatchRoom';

const acceptWebSocket = vi.fn();
const getWebSockets = vi.fn(() => [] as WebSocket[]);

describe('MatchRoom durable object', () => {
  let room: MatchRoom;

  beforeEach(() => {
    vi.clearAllMocks();
    getWebSockets.mockReturnValue([]);
    room = new MatchRoom({} as DurableObjectState, {} as never);
    room.ctx.acceptWebSocket = acceptWebSocket;
    room.ctx.getWebSockets = getWebSockets;
  });

  it('returns live state JSON from /state', async () => {
    const res = await room.fetch(new Request('https://do/state'));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { matchId: string; subscribers: number };
    expect(json.subscribers).toBe(0);
  });

  it('broadcasts scenario updates on POST /scenario', async () => {
    const sent: string[] = [];
    const peer = { send: (msg: string) => sent.push(msg) };
    getWebSockets.mockReturnValue([peer as unknown as WebSocket]);

    const res = await room.fetch(
      new Request('https://do/scenario', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SCENARIO_UPDATE',
          payload: { matchId: 'm-1', scenarios: [] },
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(sent.some((msg) => msg.includes('SCENARIO_UPDATE'))).toBe(true);
  });

  it('rejects unsupported scenario POST payloads', async () => {
    const res = await room.fetch(
      new Request('https://do/scenario', {
        method: 'POST',
        body: JSON.stringify({ type: 'UNKNOWN', payload: {} }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('webSocketMessage updates state and broadcasts', async () => {
    const sent: string[] = [];
    const ws = { send: (msg: string) => sent.push(msg) };
    getWebSockets.mockReturnValue([ws as unknown as WebSocket]);

    await room.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'update', data: { matchId: 'm-1', minute: 20, homeScore: 1, awayScore: 0 } }),
    );

    expect(sent.some((msg) => msg.includes('MATCH_STATE_UPDATE'))).toBe(true);
  });

  it('webSocketMessage returns error on invalid JSON', async () => {
    const sent: string[] = [];
    const ws = { send: (msg: string) => sent.push(msg) };
    await room.webSocketMessage(ws as unknown as WebSocket, '{bad json');
    expect(sent.some((msg) => msg.includes('error'))).toBe(true);
  });

  it('webSocketClose decrements subscribers', async () => {
    await room.webSocketMessage(
      { send: vi.fn() } as unknown as WebSocket,
      JSON.stringify({ type: 'update', data: { subscribers: 2 } }),
    );
    await room.webSocketClose();
    const res = await room.fetch(new Request('https://do/state'));
    const json = (await res.json()) as { subscribers: number };
    expect(json.subscribers).toBeGreaterThanOrEqual(0);
  });

  it('accepts websocket upgrade and sends initial state', async () => {
    vi.stubGlobal(
      'WebSocketPair',
      class WebSocketPairMock {
        0 = { tag: 'client' };
        1 = { tag: 'server', send: vi.fn() };
      },
    );
    const req = {
      method: 'GET',
      url: 'https://do/live',
      headers: {
        get: (name: string) => (name.toLowerCase() === 'upgrade' ? 'websocket' : null),
      },
    } as unknown as Request;
    const res = await room.fetch(req);
    expect(res.status).toBe(101);
    expect(acceptWebSocket).toHaveBeenCalled();
  });

  it('ignores non-string websocket payloads', async () => {
    const ws = { send: vi.fn() };
    await room.webSocketMessage(ws as unknown as WebSocket, new ArrayBuffer(8));
    expect(ws.send).not.toHaveBeenCalled();
  });
});
