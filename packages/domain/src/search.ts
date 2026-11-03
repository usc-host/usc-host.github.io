import { fromPriceCents, productDescription, type CatalogIndex } from './catalog.ts';
import { normalize } from './text.ts';
import type { Product } from './types.ts';

export interface SearchInput {
  query?: string;
  categoryId?: string;
  maxPriceCents?: number;
  kind?: 'salgada' | 'doce';
}

function haystack(index: CatalogIndex, product: Product): string {
  const parts = [product.name, productDescription(product)];
  for (const v of product.variants) {
    parts.push(v.label, v.description ?? '', ...(v.ingredients ?? []));
    for (const id of v.flavors?.options ?? []) parts.push(index.flavor(id)?.name ?? '');
  }
  for (const id of product.categoryIds) parts.push(index.catalog.categories.find(c => c.id === id)?.name ?? '');
  return normalize(parts.join(' '));
}

const sweet = /doce|churros|nutella|chocolate|doce de leite/;

/* Every query word must appear somewhere in the product text. */
export function searchProducts(index: CatalogIndex, input: SearchInput): Product[] {
  const words = normalize(input.query ?? '').split(/\s+/).filter(w => w.length > 1);
  return index.catalog.products.filter(product => {
    if (input.categoryId && !product.categoryIds.includes(input.categoryId)) return false;
    if (input.maxPriceCents !== undefined) {
      const price = fromPriceCents(index, product);
      if (price === null || price > input.maxPriceCents) return false;
    }
    const text = haystack(index, product);
    if (input.kind === 'doce' && !sweet.test(text)) return false;
    if (input.kind === 'salgada' && (product.categoryIds.includes('doces') || product.categoryIds.includes('bebidas'))) return false;
    return words.every(w => text.includes(w));
  });
}
