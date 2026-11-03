import { describe, expect, it } from 'vitest';
import cases from '../../../data/quote-cases.json' with { type: 'json' };
import { defaultIndex } from './catalog.ts';
import { quoteLine } from './quote.ts';
import type { LineConfig } from './types.ts';

/* The same file runs in the C# test suite, so the browser preview and the
   API, which has the final word on prices, cannot drift apart. */
interface Case {
  name: string;
  line: LineConfig;
  ok: boolean;
  unitCents?: number;
  totalCents?: number;
  parts?: number[];
  issues?: string[];
}

describe('casos compartilhados com a API', () => {
  for (const c of cases.cases as Case[]) {
    it(c.name, () => {
      const q = quoteLine(defaultIndex, c.line);
      expect(q.ok).toBe(c.ok);
      if (c.unitCents !== undefined) expect(q.unitCents).toBe(c.unitCents);
      if (c.totalCents !== undefined) expect(q.totalCents).toBe(c.totalCents);
      if (c.parts) expect(q.parts.map(p => p.cents)).toEqual(c.parts);
      if (c.issues) expect(q.issues.map(i => i.code)).toEqual(c.issues);
    });
  }
});
