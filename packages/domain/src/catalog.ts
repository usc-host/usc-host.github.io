import raw from '../../../data/catalog.json' with { type: 'json' };
import type { Catalog, ComboGroup, Flavor, OptionGroup, Product, Variant } from './types.ts';

export const catalog = raw as Catalog;

export interface CatalogIndex {
  catalog: Catalog;
  product(id: string): Product | undefined;
  productBySlug(slug: string): Product | undefined;
  variant(productId: string, variantId: string): Variant | undefined;
  flavor(id: string): Flavor | undefined;
  optionGroup(id: string): OptionGroup | undefined;
  /* Any variant by its id, with the product it belongs to. */
  item(variantId: string): { product: Product; variant: Variant } | undefined;
}

export function indexCatalog(source: Catalog): CatalogIndex {
  const products = new Map(source.products.map(p => [p.id, p]));
  const slugs = new Map(source.products.map(p => [p.slug, p]));
  const flavors = new Map(source.flavors.map(f => [f.id, f]));
  const groups = new Map(source.optionGroups.map(g => [g.id, g]));
  const items = new Map(source.products.flatMap(product => product.variants.map(variant => [variant.id, { product, variant }] as const)));
  return {
    catalog: source,
    product: id => products.get(id),
    productBySlug: slug => slugs.get(slug),
    variant: (productId, variantId) => products.get(productId)?.variants.find(v => v.id === variantId),
    flavor: id => flavors.get(id),
    optionGroup: id => groups.get(id),
    item: id => items.get(id)
  };
}

export const defaultIndex = indexCatalog(catalog);

/* Lowest price a customer can pay for the product, used for "a partir de".
   A fraction_sum pizza costs at least its cheapest flavor taken whole. */
export function fromPriceCents(index: CatalogIndex, product: Product): number | null {
  let lowest: number | null = null;
  for (const variant of product.variants) {
    const price = variantFromPrice(index, variant);
    if (price !== null && (lowest === null || price < lowest)) lowest = price;
  }
  return lowest;
}

export function variantFromPrice(index: CatalogIndex, variant: Variant): number | null {
  const pricing = variant.pricing;
  if (pricing.type === 'fixed') return pricing.priceCents;
  if (pricing.type === 'fraction_sum' && variant.flavors) {
    const prices = variant.flavors.options
      .map(id => index.flavor(id)?.prices[pricing.table])
      .filter((p): p is number => typeof p === 'number');
    return prices.length ? Math.min(...prices) : null;
  }
  return null;
}

/* True when the customer only picks quantity, so the card can add it directly. */
export function isDirectAdd(product: Product): boolean {
  if (product.variants.length !== 1) return false;
  const v = product.variants[0]!;
  return !v.flavors && !v.comboGroups?.length && !v.optionGroupIds?.length;
}

export function primaryImage(product: Product) {
  return product.image ?? product.variants.find(v => v.image)?.image ?? null;
}

/* A flavor shows its own photo or the photo of the house pizza it comes from. */
export function flavorImage(index: CatalogIndex, flavorId: string) {
  const flavor = index.flavor(flavorId);
  if (flavor?.image) return flavor.image;
  const product = index.product(flavor?.productId ?? '');
  return product ? primaryImage(product) : null;
}

/* Dough and sauce make the pizza; they are listed but cannot be removed. */
export function isBaseIngredient(name: string): boolean {
  return /^(massa|molho de tomate)/i.test(name);
}

export function comboOptionName(index: CatalogIndex, group: ComboGroup, id: string): string | undefined {
  return group.source === 'flavor' ? index.flavor(id)?.name : index.item(id)?.variant.label;
}

/* Label for a fixed price line: a size joins the product name, a flavor or a
   drink stands on its own. */
export function variantDisplayName(product: Product, variant: Variant): string {
  if (product.variants.length === 1) return product.name;
  return (product.variantLabel ?? 'Tamanho') === 'Tamanho' ? `${product.name} ${variant.label.toLowerCase()}` : variant.label;
}

export function productDescription(product: Product): string {
  return product.summary ?? product.variants.find(v => v.description)?.description ?? '';
}
