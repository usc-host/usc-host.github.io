import { describe, expect, it } from 'vitest';
import { catalog, defaultIndex as index, fromPriceCents, indexCatalog } from './catalog.ts';
import { formatBRL } from './money.ts';
import { lineKey, quoteCart, quoteLine } from './quote.ts';
import { searchProducts } from './search.ts';
import { cleanDashes } from './text.ts';
import type { Catalog } from './types.ts';

const grande = { productId: 'pizza-grande', variantId: 'pizza-grande-8', quantity: 1 };

describe('pizza com frações', () => {
  it('cobra o sabor inteiro quando há um só sabor', () => {
    const q = quoteLine(index, { ...grande, flavorIds: ['calabresa'] });
    expect(q.ok).toBe(true);
    expect(q.unitCents).toBe(5690);
  });

  it('soma metades exatas em dois sabores', () => {
    const q = quoteLine(index, { ...grande, flavorIds: ['calabresa', 'cupim-supremo'] });
    expect(q.parts.map(p => p.cents)).toEqual([2845, 4495]);
    expect(q.unitCents).toBe(7340);
  });

  it('arredonda cada fração para o centavo mais próximo', () => {
    const q = quoteLine(index, { ...grande, flavorIds: ['calabresa', 'mussarela', 'presunto'] });
    // 5690 / 3 = 1896,67 vira 1897 em cada terço
    expect(q.parts.map(p => p.cents)).toEqual([1897, 1897, 1897]);
    expect(q.unitCents).toBe(5691);
  });

  it('respeita o limite de sabores de cada tamanho', () => {
    const cinco = quoteLine(index, { ...grande, flavorIds: ['calabresa', 'mussarela', 'presunto', 'portuguesa', 'tres-queijos'] });
    expect(cinco.ok).toBe(false);
    expect(cinco.issues[0]?.code).toBe('FLAVORS_EXCEEDED');
    const broto = quoteLine(index, { productId: 'pizza-broto', variantId: 'pizza-broto-4', quantity: 1, flavorIds: ['calabresa', 'mussarela', 'presunto'] });
    expect(broto.issues.map(i => i.code)).toContain('FLAVORS_EXCEEDED');
  });

  it('exige ao menos um sabor e recusa repetição', () => {
    expect(quoteLine(index, grande).issues[0]?.code).toBe('FLAVORS_MISSING');
    expect(quoteLine(index, { ...grande, flavorIds: ['calabresa', 'calabresa'] }).issues.map(i => i.code)).toContain('FLAVOR_REPEATED');
  });

  it('não aceita sabor fora do tamanho', () => {
    const q = quoteLine(index, { productId: 'pizza-broto', variantId: 'pizza-broto-4', quantity: 1, flavorIds: ['cupim-supremo'] });
    expect(q.issues[0]?.code).toBe('FLAVOR_UNAVAILABLE');
  });

  it('soma borda e multiplica pela quantidade', () => {
    const q = quoteLine(index, { ...grande, quantity: 3, flavorIds: ['mussarela'], optionIds: ['borda-chocolate'] });
    expect(q.unitCents).toBe(5690 + 1399);
    expect(q.totalCents).toBe((5690 + 1399) * 3);
  });

  it('recusa duas bordas e borda de outro produto', () => {
    expect(quoteLine(index, { ...grande, flavorIds: ['mussarela'], optionIds: ['borda-cheddar', 'borda-requeijao'] }).issues[0]?.code).toBe('OPTION_EXCEEDED');
    const broto = quoteLine(index, { productId: 'pizza-broto', variantId: 'pizza-broto-4', quantity: 1, flavorIds: ['mussarela'], optionIds: ['borda-cheddar'] });
    expect(broto.issues[0]?.code).toBe('OPTION_UNAVAILABLE');
  });
});

describe('combos', () => {
  const casal = { productId: 'combo-casal', variantId: 'combo-casal-20', quantity: 1 };

  it('exige a soma exata de esfihas', () => {
    const faltando = quoteLine(index, { ...casal, combo: { esfihas: { 'esfiha-carne': 12 } } });
    expect(faltando.issues[0]?.code).toBe('COMBO_INCOMPLETE');
    const sobrando = quoteLine(index, { ...casal, combo: { esfihas: { 'esfiha-carne': 15, 'esfiha-queijo': 6 } } });
    expect(sobrando.issues[0]?.code).toBe('COMBO_EXCEEDED');
    const certo = quoteLine(index, { ...casal, combo: { esfihas: { 'esfiha-carne': 14, 'esfiha-queijo': 6 } } });
    expect(certo.ok).toBe(true);
    expect(certo.unitCents).toBe(7990);
  });

  it('não aceita item de outro grupo', () => {
    const q = quoteLine(index, { ...casal, combo: { esfihas: { 'esfiha-carne': 19, 'esfiha-churros': 1 } } });
    expect(q.issues.map(i => i.code)).toContain('COMBO_OPTION_UNAVAILABLE');
  });

  it('valida todos os grupos do Combo da Semana, incluindo bebida', () => {
    const base = { productId: 'combo-da-semana', variantId: 'combo-da-semana-unico', quantity: 1 };
    const semRefri = quoteLine(index, { ...base, combo: { pizza: { calabresa: 1 }, 'broto-doce': { churros: 1 } } });
    expect(semRefri.issues.map(i => i.groupId)).toEqual(['refri']);
    const completo = quoteLine(index, { ...base, combo: { pizza: { calabresa: 1 }, 'broto-doce': { churros: 1 }, refri: { 'guarana-2l': 1 } } });
    expect(completo.ok).toBe(true);
    expect(completo.unitCents).toBe(9990);
  });

  it('Pizza Trem pede 4 sabores diferentes', () => {
    const base = { productId: 'pizza-trem', variantId: 'pizza-trem-70', quantity: 1 };
    const repetido = quoteLine(index, { ...base, combo: { sabores: { calabresa: 4 }, refri: { 'conquista-2l': 1 } } });
    expect(repetido.issues.map(i => i.code)).toContain('COMBO_REPEATED');
  });
});

describe('carrinho e catálogo', () => {
  it('produto inexistente gera erro claro, sem preço', () => {
    const q = quoteLine(index, { productId: 'pizza-de-ouro', variantId: 'x', quantity: 1 });
    expect(q.ok).toBe(false);
    expect(q.totalCents).toBeNull();
    expect(q.issues[0]?.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('revalida quando o preço do catálogo muda', () => {
    const line = { productId: 'guarana-2l', variantId: 'guarana-2l-un', quantity: 2 };
    expect(quoteCart(index, [line]).totalCents).toBe(3380);
    const changed: Catalog = structuredClone(catalog);
    const variant = changed.products.find(p => p.id === 'guarana-2l')!.variants[0]!;
    variant.pricing = { type: 'fixed', priceCents: 1790 };
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
    const quote = quoteCart(index, [{ productId: 'coca-lata', variantId: 'coca-lata-un', quantity: 1 }]);
    expect(quote.deliveryCents).toBeNull();
    expect(quote.complete).toBe(true);
  });

  it('mesma configuração gera a mesma chave de linha', () => {
    const a = lineKey({ ...grande, flavorIds: ['calabresa'], optionIds: ['borda-cheddar'], note: ' sem cebola ' });
    const b = lineKey({ ...grande, quantity: 4, flavorIds: ['calabresa'], optionIds: ['borda-cheddar'], note: 'sem cebola' });
    expect(a).toBe(b);
  });

  it('preço a partir de usa o sabor mais barato', () => {
    expect(fromPriceCents(index, index.product('pizza-grande')!)).toBe(5690);
    expect(fromPriceCents(index, index.product('pizza-broto')!)).toBe(3980);
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

  it('filtra por teto de preço', () => {
    const baratos = searchProducts(index, { categoryId: 'premium', maxPriceCents: 7000 });
    // Os brotos de Cupim Supremo (62,90) e Bella Tarê (48,90) entram no teto
    expect(baratos.map(p => p.id)).toEqual(['cupim-supremo', 'bella-tare']);
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
