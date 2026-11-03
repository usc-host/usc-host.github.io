import type { LineConfig, Quote } from '@bella/domain';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8787';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/* Every request has a deadline; the caller's signal can cancel it earlier. */
export async function apiFetch<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 15000, signal, ...rest } = init;
  const deadline = AbortSignal.timeout(timeoutMs);
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...rest.headers },
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline
  });
  if (!res.ok) {
    let message = 'Não foi possível falar com a loja agora.';
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      /* body without JSON */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export function requestQuote(lines: LineConfig[], signal?: AbortSignal) {
  return apiFetch<Quote>('/api/quotes', { method: 'POST', body: JSON.stringify({ lines }), signal, timeoutMs: 20000 });
}

/* Render free instances sleep when idle. A ping on load wakes the API while
   the customer is still browsing, so quotes and chat answer faster. */
let warm: Promise<boolean> | null = null;
export function warmUpApi() {
  warm ??= apiFetch('/api/health', { timeoutMs: 70000 }).then(() => true, () => { warm = null; return false; });
  return warm;
}
