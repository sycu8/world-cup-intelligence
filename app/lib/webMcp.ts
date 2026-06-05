/**
 * WebMCP — expose key site actions to in-browser AI agents.
 * https://webmachinelearning.github.io/webmcp/
 */

type ModelContext = {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: Record<string, unknown>) => Promise<unknown>;
  }) => void;
};

type NavigatorWithMcp = Navigator & { modelContext?: ModelContext };

const API = '/api';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export function registerWebMcpTools(): void {
  const nav = navigator as NavigatorWithMcp;
  if (!nav.modelContext?.registerTool) return;

  nav.modelContext.registerTool({
    name: 'get_home',
    description: 'Fetch homepage bundle: featured match, WC 2026 schedule (104 matches), and hot news.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => apiGet('/home'),
  });

  nav.modelContext.registerTool({
    name: 'get_schedule',
    description: 'Fetch the FIFA World Cup 2026 match schedule with scores and probabilities.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => apiGet('/schedule'),
  });

  nav.modelContext.registerTool({
    name: 'get_match_probability',
    description: 'Get model win/draw/loss probabilities and xG for a match.',
    inputSchema: {
      type: 'object',
      properties: { matchId: { type: 'string', description: 'Match id e.g. m-w26-ga-1v2' } },
      required: ['matchId'],
      additionalProperties: false,
    },
    execute: async (input) => apiGet(`/matches/${input.matchId}/probability`),
  });

  nav.modelContext.registerTool({
    name: 'get_match_wc_history',
    description: 'Get past World Cup head-to-head meetings between the two teams in a match.',
    inputSchema: {
      type: 'object',
      properties: { matchId: { type: 'string' } },
      required: ['matchId'],
      additionalProperties: false,
    },
    execute: async (input) => apiGet(`/matches/${input.matchId}/history`),
  });

  nav.modelContext.registerTool({
    name: 'get_news',
    description: 'List latest World Cup news articles.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
      },
      additionalProperties: false,
    },
    execute: async (input) => {
      const page = Number(input.page ?? 1);
      const pageSize = Number(input.pageSize ?? 8);
      return apiGet(`/news?page=${page}&pageSize=${pageSize}&hot=3`);
    },
  });

  nav.modelContext.registerTool({
    name: 'navigate_to_match',
    description: 'Open a match detail page in the browser.',
    inputSchema: {
      type: 'object',
      properties: { matchId: { type: 'string' } },
      required: ['matchId'],
      additionalProperties: false,
    },
    execute: async (input) => {
      window.location.assign(`/matches/${input.matchId}`);
      return { navigated: `/matches/${input.matchId}` };
    },
  });
}
