import { describe, expect, it } from 'vitest';
import cases from '../../../data/delivery-cases.json' with { type: 'json' };
import { defaultIndex } from './catalog.ts';
import { findDeliveryFee, openState } from './delivery.ts';

/* The same file runs in the C# suite. */
interface Case {
  name: string;
  district: string;
  status: string;
  feeCents?: number;
  options?: number;
}

const store = defaultIndex.catalog.store;

describe('taxa por bairro', () => {
  for (const c of cases.cases as Case[]) {
    it(c.name, () => {
      const r = findDeliveryFee(store, c.district);
      expect(r.status).toBe(c.status);
      if (c.feeCents !== undefined && r.status === 'found') expect(r.feeCents).toBe(c.feeCents);
      if (c.options !== undefined && r.status === 'ambiguous') expect(r.options).toHaveLength(c.options);
    });
  }
});

describe('horário de funcionamento', () => {
  it('aberto numa terça às 20h de Brasília', () => {
    expect(openState(store, new Date('2026-11-03T23:00:00Z')).open).toBe(true);
  });
  it('fechado de madrugada e abre no mesmo dia', () => {
    const s = openState(store, new Date('2026-11-04T05:00:00Z'));
    expect(s.open).toBe(false);
    expect(s.next?.label).toBe('Quarta');
  });
  it('depois das 23:30 a próxima abertura é no dia seguinte', () => {
    const s = openState(store, new Date('2026-11-08T02:45:00Z'));
    expect(s.open).toBe(false);
    expect(s.next?.label).toBe('Domingo');
  });
});
