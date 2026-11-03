import type { Quote } from '@bella/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestQuote } from '../../lib/api';
import type { CartLine } from './CartProvider';

export type ServerQuoteState =
  | { status: 'idle' | 'loading'; quote: Quote | null }
  | { status: 'ready'; quote: Quote }
  | { status: 'error'; quote: Quote | null; message: string };

/* Revalidates the cart with the API, which has the final word on prices.
   A newer request always wins; stale answers are dropped. */
export function useServerQuote(lines: CartLine[]) {
  const [state, setState] = useState<ServerQuoteState>({ status: 'idle', quote: null });
  const seq = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const signature = JSON.stringify(lines.map(l => l.config));

  useEffect(() => {
    if (!lines.length) {
      setState({ status: 'idle', quote: null });
      return;
    }
    const id = ++seq.current;
    const controller = new AbortController();
    setState(s => ({ status: 'loading', quote: s.quote }));
    const timer = setTimeout(() => {
      requestQuote(lines.map(l => l.config), controller.signal)
        .then(quote => {
          if (id === seq.current) setState({ status: 'ready', quote });
        })
        .catch((error: Error) => {
          if (id !== seq.current || controller.signal.aborted) return;
          setState(s => ({
            status: 'error',
            quote: s.quote,
            message: error.name === 'TimeoutError' ? 'A loja demorou para responder.' : 'Não foi possível confirmar os valores agora.'
          }));
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // signature captures every change that matters in lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  const expired = state.quote ? new Date(state.quote.expiresAt).getTime() < Date.now() : false;
  return { ...state, expired, retry };
}
