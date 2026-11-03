import type { CartProposal, ChatEvent, ChatMessage, ProductCard } from '@bella/domain';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { readJson, removeKey, session, writeJson } from '../../lib/storage';
import { useCart } from '../cart/CartProvider';
import { streamChat } from './chatApi';

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: ProductCard[];
  proposals?: CartProposal[];
  state?: 'streaming' | 'done' | 'stopped' | 'error';
  error?: { message: string; retryable: boolean };
}

interface ChatApi {
  open: boolean;
  setOpen(open: boolean): void;
  messages: UiMessage[];
  busy: boolean;
  statusLabel: string | null;
  mode: 'gemini' | 'local' | null;
  dismissed: string[];
  send(text: string): void;
  stop(): void;
  retry(): void;
  clear(): void;
  dismiss(proposalId: string): void;
}

/* The conversation lives in this tab's sessionStorage only: it survives page
   changes and reloads, disappears with the tab, and can be cleared any time. */
const KEY = 'bm-chat';
const ChatContext = createContext<ChatApi | null>(null);
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`;

interface Saved {
  v: 1;
  messages: UiMessage[];
  dismissed: string[];
  mode: 'gemini' | 'local' | null;
}

function restore(): Saved {
  const saved = readJson<Saved>(session, KEY);
  if (saved?.v !== 1 || !Array.isArray(saved.messages)) return { v: 1, messages: [], dismissed: [], mode: null };
  // An answer interrupted by a reload is shown as stopped, never as still typing.
  const messages = saved.messages.map(m => (m.state === 'streaming' ? { ...m, state: 'stopped' as const } : m));
  return { ...saved, messages };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(restore, []);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>(initial.messages);
  const [dismissed, setDismissed] = useState<string[]>(initial.dismissed);
  const [mode, setMode] = useState(initial.mode);
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const cart = useCart();
  const location = useLocation();
  const context = useRef({ cart, path: location.pathname });
  context.current = { cart, path: location.pathname };

  useEffect(() => {
    writeJson(session, KEY, { v: 1, messages: messages.slice(-60), dismissed: dismissed.slice(-60), mode } satisfies Saved);
  }, [messages, dismissed, mode]);

  useEffect(() => () => controller.current?.abort(), []);

  const patch = useCallback((id: string, update: (m: UiMessage) => UiMessage) => {
    setMessages(list => list.map(m => (m.id === id ? update(m) : m)));
  }, []);

  const run = useCallback(async (history: UiMessage[]) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const reply: UiMessage = { id: uid(), role: 'assistant', text: '', state: 'streaming' };
    setMessages([...history, reply]);
    setBusy(true);
    setStatusLabel('Pensando');

    // Only finished text goes to the model; cards and failed turns stay on screen.
    const transcript: ChatMessage[] = history
      .filter(m => m.text.trim() && m.state !== 'error')
      .map(m => ({ role: m.role, text: m.text }));
    const { cart: currentCart, path } = context.current;
    const snapshot = currentCart.lines.map(l => {
      const q = currentCart.previews.get(l.id);
      return { lineId: l.id, name: q ? `${q.name}${q.variantLabel && q.variantLabel !== 'Inteira' ? ` ${q.variantLabel.toLowerCase()}` : ''}` : l.config.productId, quantity: l.config.quantity, summary: q?.summary ?? [] };
    });

    const onEvent = (event: ChatEvent) => {
      switch (event.type) {
        case 'text':
          setStatusLabel(null);
          patch(reply.id, m => ({ ...m, text: m.text + event.delta }));
          break;
        case 'status':
          setStatusLabel(event.label);
          break;
        case 'products':
          patch(reply.id, m => ({ ...m, products: [...(m.products ?? []), ...event.items] }));
          break;
        case 'proposal':
          patch(reply.id, m => ({ ...m, proposals: [...(m.proposals ?? []), event.proposal] }));
          break;
        case 'done':
          setMode(event.mode);
          patch(reply.id, m => ({ ...m, state: 'done' }));
          break;
        case 'error':
          patch(reply.id, m => ({ ...m, state: 'error', error: { message: event.message, retryable: event.retryable } }));
          break;
      }
    };

    try {
      await streamChat({ messages: transcript, cart: snapshot, page: path }, onEvent, abort.signal);
      patch(reply.id, m => (m.state === 'streaming' ? { ...m, state: 'done' } : m));
    } catch (error) {
      if (abort.signal.aborted) {
        patch(reply.id, m => ({ ...m, state: 'stopped' }));
      } else {
        const message = error instanceof TypeError
          ? 'Não consegui falar com o assistente. Confira sua conexão e tente de novo.'
          : (error as Error).message;
        patch(reply.id, m => ({ ...m, state: 'error', error: { message, retryable: true } }));
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
        setStatusLabel(null);
      }
    }
  }, [patch]);

  const send = useCallback((text: string) => {
    const clean = text.trim().slice(0, 600);
    if (!clean || controller.current) return;
    setOpen(true);
    run([...messages, { id: uid(), role: 'user', text: clean }]);
  }, [messages, run]);

  const stop = useCallback(() => controller.current?.abort(), []);

  /* Repeats the last customer message, replacing the answer after it. */
  const retry = useCallback(() => {
    if (controller.current) return;
    const lastUser = messages.findLastIndex(m => m.role === 'user');
    if (lastUser < 0) return;
    run(messages.slice(0, lastUser + 1));
  }, [messages, run]);

  const clear = useCallback(() => {
    controller.current?.abort();
    setMessages([]);
    setDismissed([]);
    removeKey(session, KEY);
  }, []);

  const dismiss = useCallback((id: string) => setDismissed(list => [...list, id]), []);

  const value = useMemo<ChatApi>(() => ({
    open, setOpen, messages, busy, statusLabel, mode, dismissed, send, stop, retry, clear, dismiss
  }), [open, messages, busy, statusLabel, mode, dismissed, send, stop, retry, clear, dismiss]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat fora do ChatProvider');
  return ctx;
}
