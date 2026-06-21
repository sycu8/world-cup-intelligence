import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchScenarioLive } from '../../app/lib/useMatchScenarioLive';
import { SMOKE_MATCH_ID } from '../helpers/smokeFixtures';

describe('useMatchScenarioLive websocket', () => {
  class MockWebSocket {
    static instances: MockWebSocket[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(public url: string) {
      MockWebSocket.instances.push(this);
      queueMicrotask(() => this.onopen?.());
    }

    close() {
      this.onclose?.();
    }

    send(data: string) {
      this.onmessage?.({ data });
    }
  }

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes callback on SCENARIO_UPDATE messages', async () => {
    const onUpdate = vi.fn();
    const { unmount } = renderHook(() => useMatchScenarioLive(SMOKE_MATCH_ID, onUpdate, true));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].send(
        JSON.stringify({ type: 'SCENARIO_UPDATE', payload: { scenarios: [{ id: 's1' }] } }),
      );
    });
    expect(onUpdate).toHaveBeenCalled();
    unmount();
  });

  it('ignores malformed websocket frames', async () => {
    const onUpdate = vi.fn();
    const { unmount } = renderHook(() => useMatchScenarioLive(SMOKE_MATCH_ID, onUpdate, true));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].send('not-json');
    });
    expect(onUpdate).not.toHaveBeenCalled();
    unmount();
  });

  it('reconnects after close and handles onerror', async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const { unmount } = renderHook(() => useMatchScenarioLive(SMOKE_MATCH_ID, onUpdate, true));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(MockWebSocket.instances.length).toBe(1);
    act(() => {
      MockWebSocket.instances[0].onerror?.();
      MockWebSocket.instances[0].onclose?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    unmount();
  }, 15000);
});
