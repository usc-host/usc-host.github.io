import type { LineConfig, LineQuote } from './types.ts';

/* Structured pieces the assistant streams next to its text. */

export interface ProductCard {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  fromPriceCents: number | null;
  description: string;
  reason?: string;
}

export interface StoreLocation {
  name: string;
  address: string;
  mapsUrl: string;
}

export interface StoreContact {
  name: string;
  phone: string;
  whatsappUrl: string;
}

export interface CartProposal {
  id: string;
  action: 'add' | 'remove' | 'set_quantity';
  line?: LineConfig;
  lineId?: string;
  quantity?: number;
  quote?: LineQuote;
  label: string;
  expiresAt: string;
}

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'status'; label: string }
  | { type: 'products'; items: ProductCard[] }
  | { type: 'proposal'; proposal: CartProposal }
  | { type: 'location'; location: StoreLocation }
  | { type: 'contact'; contact: StoreContact }
  | { type: 'done'; mode: 'gemini' | 'local'; model?: string }
  | { type: 'error'; message: string; retryable: boolean };

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/* Cart context sent with each chat message. No personal data, only what the
   assistant needs to propose changes to existing lines. */
export interface CartSnapshotLine {
  lineId: string;
  name: string;
  quantity: number;
  summary: string[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  cart?: CartSnapshotLine[];
  page?: string;
}
