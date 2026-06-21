import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMatchLiveData } from '../../app/lib/useMatchLiveData';
import { usePitchMapLive } from '../../app/lib/usePitchMapLive';
import { installSmokeFetchMock } from '../helpers/smokeFetch';
import { samplePitchMap, sampleProbability, SMOKE_MATCH_ID } from '../helpers/smokeFixtures';

describe('live data hooks', () => {
  it('useMatchLiveData loads and refreshes', async () => {
    installSmokeFetchMock();
    const { result, unmount } = renderHook(() => useMatchLiveData(SMOKE_MATCH_ID));
    await waitFor(() => expect(result.current.match?.id).toBe(SMOKE_MATCH_ID));
    expect(result.current.prob?.homeWinProb).toBe(sampleProbability.homeWinProb);
    await act(async () => {
      await result.current.refresh();
    });
    unmount();
  });

  it('usePitchMapLive loads and reloads', async () => {
    installSmokeFetchMock();
    const { result, unmount } = renderHook(() => usePitchMapLive(SMOKE_MATCH_ID, false));
    await waitFor(() => expect(result.current.data?.home.teamName).toBe(samplePitchMap.home.teamName));
    await act(async () => {
      await result.current.reload();
    });
    unmount();
  });
});
