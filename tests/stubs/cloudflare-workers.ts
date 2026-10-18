export class DurableObject {
  ctx: {
    acceptWebSocket: (ws: WebSocket) => void;
    getWebSockets: () => WebSocket[];
  };

  constructor(_state: DurableObjectState, _env: unknown) {
    this.ctx = {
      acceptWebSocket: () => undefined,
      getWebSockets: () => [],
    };
  }
}
