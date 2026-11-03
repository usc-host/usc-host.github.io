import type { ChatEvent, ChatRequest } from '@bella/domain';
import { API_URL, ApiError } from '../../lib/api';

/* Posts the conversation and reads the server sent events stream. */
export async function streamChat(request: ChatRequest, onEvent: (event: ChatEvent) => void, signal: AbortSignal) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(request),
    signal
  });
  if (!res.ok || !res.body) {
    let message = 'O assistente está indisponível no momento.';
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      /* body without JSON */
    }
    throw new ApiError(message, res.status);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let cut;
    while ((cut = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, '');
      const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
      if (data) onEvent(JSON.parse(data) as ChatEvent);
    }
    if (done) break;
  }
}
