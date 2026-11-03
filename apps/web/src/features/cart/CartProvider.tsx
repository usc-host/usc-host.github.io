import { defaultIndex, lineKey, MAX_QUANTITY, quoteLine, type LineConfig, type LineQuote } from '@bella/domain';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { local, readJson, writeJson } from '../../lib/storage';

export interface CartLine {
  id: string;
  config: LineConfig;
  addedAt: number;
}

interface CartState {
  lines: CartLine[];
  /* Assistant proposals already applied, so a repeated confirmation never
     adds the same item twice. */
  appliedProposals: string[];
}

const KEY = 'bm-cart';
const VERSION = 1;

type Action =
  | { type: 'add'; config: LineConfig }
  | { type: 'replace'; id: string; config: LineConfig }
  | { type: 'quantity'; id: string; quantity: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'proposal'; proposalId: string }
  | { type: 'hydrate'; state: CartState };

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 13);
const clamp = (n: number) => Math.max(1, Math.min(MAX_QUANTITY, Math.round(n)));

/* Same configuration means same line: quantities are merged. */
function merge(lines: CartLine[], config: LineConfig, skipId?: string): CartLine[] {
  const key = lineKey(config);
  const existing = lines.find(l => l.id !== skipId && lineKey(l.config) === key);
  if (!existing) return [...lines, { id: newId(), config: { ...config, quantity: clamp(config.quantity) }, addedAt: Date.now() }];
  return lines.map(l => (l === existing ? { ...l, config: { ...l.config, quantity: clamp(l.config.quantity + config.quantity) } } : l));
}

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'add':
      return { ...state, lines: merge(state.lines, action.config) };
    case 'replace': {
      const rest = state.lines.filter(l => l.id !== action.id);
      const key = lineKey(action.config);
      if (rest.some(l => lineKey(l.config) === key)) return { ...state, lines: merge(rest, action.config) };
      return { ...state, lines: state.lines.map(l => (l.id === action.id ? { ...l, config: { ...action.config, quantity: clamp(action.config.quantity) } } : l)) };
    }
    case 'quantity':
      return { ...state, lines: state.lines.map(l => (l.id === action.id ? { ...l, config: { ...l.config, quantity: clamp(action.quantity) } } : l)) };
    case 'remove':
      return { ...state, lines: state.lines.filter(l => l.id !== action.id) };
    case 'clear':
      return { ...state, lines: [] };
    case 'hydrate':
      return action.state;
    case 'proposal':
      return state.appliedProposals.includes(action.proposalId)
        ? state
        : { ...state, appliedProposals: [...state.appliedProposals, action.proposalId].slice(-50) };
  }
}

/* Versioned storage with a forgiving reader: invalid JSON or an unknown
   version starts an empty cart instead of breaking the page. */
function load(): CartState {
  const saved = readJson<{ v?: number; lines?: unknown; appliedProposals?: unknown }>(local, KEY);
  if (!saved || saved.v !== VERSION || !Array.isArray(saved.lines)) return { lines: [], appliedProposals: [] };
  const lines = saved.lines.filter((l): l is CartLine =>
    !!l && typeof l === 'object' && typeof (l as CartLine).id === 'string' &&
    typeof (l as CartLine).config?.productId === 'string' && typeof (l as CartLine).config?.variantId === 'string' &&
    Number.isInteger((l as CartLine).config?.quantity));
  const applied = Array.isArray(saved.appliedProposals) ? saved.appliedProposals.filter((p): p is string => typeof p === 'string') : [];
  return { lines, appliedProposals: applied };
}

interface CartApi {
  lines: CartLine[];
  count: number;
  /* Local preview of each line with the shared rules; the server quote has the final word. */
  previews: Map<string, LineQuote>;
  add(config: LineConfig): void;
  replace(id: string, config: LineConfig): void;
  setQuantity(id: string, quantity: number): void;
  remove(id: string): void;
  clear(): void;
  isProposalApplied(id: string): boolean;
  markProposal(id: string): void;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    writeJson(local, KEY, { v: VERSION, ...state });
  }, [state]);

  // Another tab changed the cart.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === KEY) dispatch({ type: 'hydrate', state: load() });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const previews = useMemo(() => new Map(state.lines.map(l => [l.id, quoteLine(defaultIndex, l.config)])), [state.lines]);

  const add = useCallback((config: LineConfig) => dispatch({ type: 'add', config }), []);
  const replace = useCallback((id: string, config: LineConfig) => dispatch({ type: 'replace', id, config }), []);
  const setQuantity = useCallback((id: string, quantity: number) => dispatch({ type: 'quantity', id, quantity }), []);
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const markProposal = useCallback((id: string) => dispatch({ type: 'proposal', proposalId: id }), []);
  const isProposalApplied = useCallback((id: string) => state.appliedProposals.includes(id), [state.appliedProposals]);

  const value = useMemo<CartApi>(() => ({
    lines: state.lines,
    count: state.lines.reduce((sum, l) => sum + l.config.quantity, 0),
    previews,
    add,
    replace,
    setQuantity,
    remove,
    clear,
    isProposalApplied,
    markProposal
  }), [state.lines, previews, add, replace, setQuantity, remove, clear, isProposalApplied, markProposal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart fora do CartProvider');
  return ctx;
}
