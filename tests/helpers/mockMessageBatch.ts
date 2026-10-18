import { vi } from 'vitest';

export type MockQueueMessage<T> = {
  body: T;
  ack?: ReturnType<typeof vi.fn>;
  retry?: ReturnType<typeof vi.fn>;
};

export function createMockMessageBatch<T>(messages: MockQueueMessage<T>[]): MessageBatch<T> {
  return {
    messages: messages.map((m) => ({
      body: m.body,
      ack: m.ack ?? vi.fn(),
      retry: m.retry ?? vi.fn(),
    })),
  } as MessageBatch<T>;
}
