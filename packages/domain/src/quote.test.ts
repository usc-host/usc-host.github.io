import { describe, expect, it } from 'vitest';
import { catalog, defaultIndex as index, fromPriceCents, indexCatalog, primaryImage } from './catalog.ts';
import { formatBRL } from './money.ts';
import { lineKey, quoteCart, quoteLine } from './quote.ts';
import { searchProducts } from './search.ts';
import { cleanDashes } from './text.ts';
import type { Catalog } from './types.ts';

/* Price rules live in data/quote-cases.json (shared-cases.test.ts), which the
   C# suite runs too. This file covers what is specific to the browser side. */

const grande = { productId: 'monte-sua-pizza', variantId: 'pizza-grande-8', quantity: 1 };

describe('carrinho e catálogo', () => {
  it('produto inexistente gera erro claro, sem preço', () => {
    const q = quoteLine(index, { productId: 'pizza-de-ouro', variantId: 'x', quantity: 1 });
    expect(q.totalCents).toBeNull();
    expect(q.issues[0]?.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('revalida quando o preço do catálogo muda', () => {
    const line = { productId: 'bebidas', variantId: 'guarana-2l-un', quantity: 2 };
    expect(quoteCart(index, [line]).totalCents).toBe(3380);
    const changed: Catalog = structuredClone(catalog);
    changed.products.find(p => p.id === 'bebidas')!.variants.find(v => v.id === 'guarana-2l-un')!.pricing = { type: 'fixed', priceCents: 1790 };
    changed.version = 'teste';
    const quote = quoteCart(indexCatalog(changed), [line]);
    expect(quote.totalCents).toBe(3580);
    expect(quote.catalogVersion).toBe('teste');
  });

  it('política de preço ausente bloqueia a cotação', () => {
    const changed: Catalog = structuredClone(catalog);
    changed.products.find(p => p.id === 'mega-trem')!.variants[0]!.pricing = { type: 'unknown' };
    const q = quoteLine(indexCatalog(changed), { productId: 'mega-trem', variantId: 'mega-trem-unica', quantity: 1 });
    expect(q.issues[0]?.code).toBe('PRICING_POLICY_MISSING');
  });

  it('frete desconhecido continua nulo, nunca zero', () => {
    const quote = quoteCart(index, [{ productId: 'bebidas', variantId: 'coca-lata-un', quantity: 1 }]);
    expect(quote.deliveryCents).toBeNull();
    expect(quote.complete).toBe(true);
  });

  it('mesma configuração gera a mesma chave de linha', () => {
    const a = lineKey({ ...grande, flavorIds: ['calabresa'], optionIds: ['borda-cheddar'], removedIngredients: ['b', 'a'], note: ' sem cebola ' });
    const b = lineKey({ ...grande, quantity: 4, flavorIds: ['calabresa'], optionIds: ['borda-cheddar'], removedIngredients: ['a', 'b'], note: 'sem cebola' });
    expect(a).toBe(b);
  });

  it('retirar ingredientes aparece no resumo na ordem da receita', () => {
    const q = quoteLine(index, { productId: 'cupim-supremo', variantId: 'cupim-supremo-grande', quantity: 1, removedIngredients: ['Mel', 'Cebola roxa'] });
    expect(q.summary).toContain('Sem: cebola roxa, mel');
  });

  it('preço a partir de considera broto e o sabor mais barato', () => {
    expect(fromPriceCents(index, index.product('monte-sua-pizza')!)).toBe(3980);
    expect(fromPriceCents(index, index.product('bebidas')!)).toBe(790);
  });

  it('toda pizza da casa tem grande e broto', () => {
    const pizzas = catalog.products.filter(p => p.categoryIds.includes('premium'));
    for (const p of pizzas) expect(p.variants.map(v => v.label)).toEqual(['Grande', 'Broto']);
  });

  it('combos e esfihas têm foto', () => {
    for (const p of catalog.products.filter(p => p.categoryIds.includes('combos') || p.categoryIds.includes('esfihas'))) {
      expect(primaryImage(p), p.id).not.toBeNull();
    }
  });

  it('formata em reais', () => {
    expect(formatBRL(7340).replace(/\s/g, ' ')).toBe('R$ 73,40');
  });
});

describe('busca', () => {
  it('ignora acentos e maiúsculas e busca ingrediente', () => {
    expect(searchProducts(index, { query: 'TARE' }).map(p => p.id)).toContain('bella-tare');
    expect(searchProducts(index, { query: 'queijo coalho' }).map(p => p.id)).toEqual(expect.arrayContaining(['cupim-supremo', 'nordestina-especial']));
  });

  it('encontra sabor de esfiha e bebida dentro do produto', () => {
    expect(searchProducts(index, { query: 'ovomaltine' }).map(p => p.id)).toContain('esfihas-doces');
    expect(searchProducts(index, { query: 'guarana' }).map(p => p.id)).toContain('bebidas');
  });

  it('filtra por teto de preço', () => {
    const ids = searchProducts(index, { categoryId: 'premium', maxPriceCents: 6000 }).map(p => p.id);
    expect(ids).toContain('bella-tare');
    expect(ids).not.toContain('cupim-supremo');
  });
});

describe('texto', () => {
  const EM = String.fromCharCode(0x2014);
  const EN = String.fromCharCode(0x2013);
  it('remove travessões', () => {
    expect(cleanDashes(`Calabresa ${EM} a clássica`)).toBe('Calabresa, a clássica');
    expect(cleanDashes(`40${EN}65 min`)).toBe('40-65 min');
  });
});
