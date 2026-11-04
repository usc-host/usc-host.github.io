import { normalize } from './text.ts';
import type { DeliveryZone, OpeningHours, Store } from './types.ts';

/* The store's list spells the same place in many ways ("Jd.", "Jardim",
   "B.Bonita"), so names are compared as sets of words. */
const ABBREVIATIONS: Record<string, string[]> = {
  jd: ['jardim'],
  res: ['residencial'],
  cond: ['condominio'],
  b: ['barra'],
  ig: ['igaracu']
};
const IGNORED = new Set(['da', 'das', 'de', 'do', 'dos', 'bairro', 'no', 'na', 'em', 'o', 'a', 'pra', 'para']);

export function zoneWords(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .flatMap(w => ABBREVIATIONS[w] ?? [w])
    .filter(w => w && !IGNORED.has(w));
}

/* Search as the customer types in the neighborhood picker. Each typed word
   is a prefix of some word in the name, and abbreviations work both ways:
   "jardim" finds "Jd. Brasil" and "jd" finds "Jardim Panorama". Typed words
   are not expanded, so a lone "b" still finds "Brasil". */
export function matchesZoneSearch(name: string, input: string): boolean {
  const raw = normalize(name).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const words = [...raw, ...raw.flatMap(w => ABBREVIATIONS[w] ?? [])];
  const typed = normalize(input).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !IGNORED.has(w));
  return typed.every(t => {
    const full = ABBREVIATIONS[t] ?? [];
    return words.some(w => w.startsWith(t) || full.some(f => w.startsWith(f)));
  });
}

export type DeliveryLookup =
  | { status: 'found'; zone: DeliveryZone; feeCents: number }
  | { status: 'ambiguous'; options: DeliveryZone[] }
  | { status: 'confirm'; zone: DeliveryZone }
  | { status: 'not_found' };

const MAX_OPTIONS = 8;

function covers(zone: string[], query: string[]) {
  return query.every(q => zone.some(z => z === q || (q.length >= 4 && z.startsWith(q))));
}

const sameCity = (zone: DeliveryZone, city?: string) => !city || normalize(zone.city) === normalize(city);

/* Neighborhoods a customer can pick for a city, in alphabetical order.
   Entries with an invalid fee stay out until the store fixes them. */
export function deliveryOptions(store: Store, city: string): DeliveryZone[] {
  return (store.deliveryZones ?? [])
    .filter(z => z.status === 'approved' && sameCity(z, city))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/* Exact names win over partial ones, so "Camil" is not mistaken for
   "Conjunto Camilo Saade". When every match costs the same the answer is
   that fee; otherwise the customer picks one of the options. */
export function findDeliveryFee(store: Store, district: string, city?: string): DeliveryLookup {
  const query = zoneWords(district);
  if (!query.length) return { status: 'not_found' };
  const zones = (store.deliveryZones ?? []).filter(z => sameCity(z, city));
  const key = query.join(' ');
  const exact = zones.filter(z => zoneWords(z.name).join(' ') === key);
  // The city may come inside the text, as in "Centro de Igaraçu".
  const matches = exact.length ? exact : zones.filter(z => covers(zoneWords(`${z.name} ${z.city}`), query));
  if (!matches.length) return { status: 'not_found' };

  const fees = new Set(matches.map(z => z.feeCents));
  const valid = matches.every(z => z.status === 'approved');
  if (fees.size === 1 && valid) return { status: 'found', zone: matches[0]!, feeCents: matches[0]!.feeCents };
  if (matches.length === 1) return { status: 'confirm', zone: matches[0]! };
  return { status: 'ambiguous', options: matches.slice(0, MAX_OPTIONS) };
}

/* Opening hours are in Brasília time, which has no daylight saving. */
const BRT_OFFSET_MIN = -180;

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
}

export interface OpenState {
  open: boolean;
  today: OpeningHours | undefined;
  /* The next time the store opens, when it is closed. */
  next?: OpeningHours;
}

export function openState(store: Store, now: Date = new Date()): OpenState {
  const local = new Date(now.getTime() + BRT_OFFSET_MIN * 60_000);
  const day = local.getUTCDay();
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const hours = store.hours ?? [];
  const today = hours.find(h => h.day === day);
  if (today && minute >= minutes(today.open) && minute < minutes(today.close)) return { open: true, today };
  if (today && minute < minutes(today.open)) return { open: false, today, next: today };
  const next = [1, 2, 3, 4, 5, 6, 7].map(i => hours.find(h => h.day === (day + i) % 7)).find(Boolean);
  return { open: false, today, next };
}
