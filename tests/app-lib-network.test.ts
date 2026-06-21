import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/lib/api';
import { consumeHomePrefetch, startHomePrefetch } from '../app/lib/homePrefetch';
import { registerWebMcpTools } from '../app/lib/webMcp';

describe('api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds schedule URL with tournament param', async () => {
    await api.schedule('t-2026');
    expect(fetchMock).toHaveBeenCalledWith('/api/schedule?tournament=t-2026');
  });

  it('builds news URL with pagination defaults', async () => {
    await api.news();
    expect(fetchMock).toHaveBeenCalledWith('/api/news?page=1&pageSize=8&hot=3');
  });

  it('builds news URL with custom options', async () => {
    await api.news({ page: 2, pageSize: 12, hot: 5 });
    expect(fetchMock).toHaveBeenCalledWith('/api/news?page=2&pageSize=12&hot=5');
  });

  it('encodes search query', async () => {
    await api.search('usa vs mex');
    expect(fetchMock).toHaveBeenCalledWith('/api/search?q=usa%20vs%20mex');
  });

  it('builds match and tournament paths', async () => {
    await api.match('m-w26-ga-1v2');
    expect(fetchMock).toHaveBeenCalledWith('/api/matches/m-w26-ga-1v2');

    await api.tournamentStandings(2026);
    expect(fetchMock).toHaveBeenCalledWith('/api/tournaments/2026/standings');

    await api.matchProbability('slug-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/matches/slug-1/probability');
  });

  it('throws on non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(api.health()).rejects.toThrow('API 503');
  });
});

describe('homePrefetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    window.__PITCHINTEL_HOME__ = undefined;
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.__PITCHINTEL_HOME__ = undefined;
  });

  it('starts a single prefetch promise', () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { ok: true } }) });
    startHomePrefetch();
    startHomePrefetch();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/home');
    expect(window.__PITCHINTEL_HOME__).toBeDefined();
  });

  it('consumes and clears the prefetch promise', async () => {
    const payload = { data: { schedule: { matches: [] } } };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    startHomePrefetch();
    await expect(consumeHomePrefetch()).resolves.toEqual(payload);
    expect(window.__PITCHINTEL_HOME__).toBeUndefined();
    await expect(consumeHomePrefetch()).resolves.toBeNull();
  });

  it('resolves null when prefetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    startHomePrefetch();
    await expect(consumeHomePrefetch()).resolves.toBeNull();
  });
});

describe('webMcp', () => {
  const fetchMock = vi.fn();
  const registerTool = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    registerTool.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as Navigator & { modelContext?: unknown }).modelContext;
  });

  it('no-ops when modelContext is unavailable', () => {
    registerWebMcpTools();
    expect(registerTool).not.toHaveBeenCalled();
  });

  it('registers tools and executes API calls', async () => {
    (navigator as Navigator & { modelContext?: { registerTool: typeof registerTool } }).modelContext =
      { registerTool };

    registerWebMcpTools();
    expect(registerTool).toHaveBeenCalled();
    const toolNames = registerTool.mock.calls.map((call) => call[0].name);
    expect(toolNames).toContain('get_home');
    expect(toolNames).toContain('get_news');

    const getNews = registerTool.mock.calls.find((call) => call[0].name === 'get_news')![0];
    await getNews.execute({ page: 2, pageSize: 10 });
    expect(fetchMock).toHaveBeenCalledWith('/api/news?page=2&pageSize=10&hot=3');

    const getProb = registerTool.mock.calls.find(
      (call) => call[0].name === 'get_match_probability',
    )![0];
    await getProb.execute({ matchId: 'm-1' });
    expect(fetchMock).toHaveBeenCalledWith('/api/matches/m-1/probability');

    const navigate = registerTool.mock.calls.find(
      (call) => call[0].name === 'navigate_to_match',
    )![0];
    const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    await expect(navigate.execute({ matchId: 'slug-1' })).resolves.toEqual({
      navigated: '/matches/slug-1',
    });
    expect(assignSpy).toHaveBeenCalledWith('/matches/slug-1');
    assignSpy.mockRestore();
  });
});
