import type { LineConfig } from '@bella/domain';
import { local, readJson, writeJson } from './storage';

/* Units ordered per product on this browser, used to rank "Mais pedidas".
   Nothing leaves the device. */
const KEY = 'bm-stats';

export function readOrderStats(): Record<string, number> {
  const saved = readJson<Record<string, unknown>>(local, KEY) ?? {};
  return Object.fromEntries(Object.entries(saved).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0));
}

export function recordOrder(lines: LineConfig[]) {
  const stats = readOrderStats();
  for (const line of lines) stats[line.productId] = (stats[line.productId] ?? 0) + line.quantity;
  writeJson(local, KEY, stats);
}
