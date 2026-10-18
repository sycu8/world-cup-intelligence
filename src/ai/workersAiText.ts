/** Normalize a Workers AI binding result to text. */
export async function workersAiResultText(result: unknown): Promise<string> {
  if (typeof result === 'string') return collapseSse(result);
  if (isStream(result)) return readStream(result);
  if (result && typeof result === 'object') {
    if ('response' in result) {
      const inner = (result as { response: unknown }).response;
      if (typeof inner === 'string') return collapseSse(inner);
      if (isStream(inner)) return readStream(inner);
      if (inner && typeof inner === 'object') return JSON.stringify(inner);
      if (inner == null) return '';
    }
    return JSON.stringify(result);
  }
  return result == null ? '' : String(result);
}

function isStream(value: unknown): value is ReadableStream<Uint8Array | string> {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

async function readStream(stream: ReadableStream<Uint8Array | string>): Promise<string> {
  const reader = stream.getReader();
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (typeof value === 'string') chunks.push(value);
    else if (value) chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return collapseSse(chunks.join(''));
}

/** Join SSE `data:` frames. A non-stream body is returned unchanged. */
export function collapseSse(body: string): string {
  if (!/(^|\n)\s*data:\s*/.test(body)) return body;
  const parts: string[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const json = JSON.parse(payload) as { response?: unknown };
      if (typeof json.response === 'string') {
        parts.push(json.response);
        continue;
      }
      if (json.response && typeof json.response === 'object') {
        parts.push(JSON.stringify(json.response));
        continue;
      }
    } catch {
      parts.push(payload);
    }
  }
  return parts.join('');
}

/** Pull the JSON object out of prose or a markdown fence. */
export function extractJsonObject(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) return source.slice(start, end + 1);
  return source.trim();
}
