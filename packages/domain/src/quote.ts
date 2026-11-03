import { comboOptionName, isBaseIngredient, variantDisplayName, type CatalogIndex } from './catalog.ts';
import { fraction } from './money.ts';
import type { LineConfig, LineIssue, LineQuote, PricePart, Quote, Variant } from './types.ts';

export const MAX_QUANTITY = 99;
export const MAX_NOTE = 140;
export const QUOTE_TTL_MS = 30 * 60 * 1000;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function flavorIssues(index: CatalogIndex, variant: Variant, ids: string[], issues: LineIssue[]) {
  const rule = variant.flavors;
  if (!rule) {
    if (ids.length) issues.push({ field: 'flavors', code: 'FLAVORS_NOT_ALLOWED', message: 'Este produto não tem escolha de sabores.' });
    return;
  }
  if (new Set(ids).size !== ids.length) issues.push({ field: 'flavors', code: 'FLAVOR_REPEATED', message: 'Cada sabor pode ser escolhido uma vez.' });
  for (const id of ids) {
    if (!rule.options.includes(id) || !index.flavor(id)) issues.push({ field: 'flavors', code: 'FLAVOR_UNAVAILABLE', message: 'Um dos sabores escolhidos não está disponível neste tamanho.' });
  }
  if (ids.length < rule.min) {
    issues.push({ field: 'flavors', code: 'FLAVORS_MISSING', message: rule.min === 1 ? 'Escolha pelo menos 1 sabor.' : `Escolha pelo menos ${rule.min} sabores.` });
  }
  if (ids.length > rule.max) {
    issues.push({ field: 'flavors', code: 'FLAVORS_EXCEEDED', message: `Este tamanho aceita até ${plural(rule.max, 'sabor', 'sabores')}.` });
  }
}

function optionParts(index: CatalogIndex, variant: Variant, ids: string[], issues: LineIssue[], parts: PricePart[], summary: string[]) {
  const allowed = variant.optionGroupIds ?? [];
  const seen = new Set<string>();
  for (const groupId of allowed) {
    const group = index.optionGroup(groupId);
    if (!group) continue;
    const chosen = group.options.filter(o => ids.includes(o.id));
    chosen.forEach(o => seen.add(o.id));
    if (chosen.length < group.min) issues.push({ field: 'options', code: 'OPTION_MISSING', groupId, message: `Escolha ${group.name.toLowerCase()}.` });
    if (chosen.length > group.max) issues.push({ field: 'options', code: 'OPTION_EXCEEDED', groupId, message: `Escolha no máximo ${group.max} em ${group.name.toLowerCase()}.` });
    for (const o of chosen) {
      parts.push({ label: `${group.name}: ${o.name}`, cents: o.priceCents });
    }
    if (chosen.length) summary.push(`${group.name}: ${chosen.map(o => o.name).join(', ')}`);
  }
  if (ids.some(id => !seen.has(id))) issues.push({ field: 'options', code: 'OPTION_UNAVAILABLE', message: 'Um dos adicionais escolhidos não está disponível para este produto.' });
}

function ingredientIssues(variant: Variant, removed: string[], issues: LineIssue[], summary: string[]) {
  if (!removed.length) return;
  const listed = variant.ingredients ?? [];
  if (new Set(removed).size !== removed.length || removed.some(r => !listed.includes(r) || isBaseIngredient(r))) {
    issues.push({ field: 'ingredients', code: 'INGREDIENT_UNAVAILABLE', message: 'Só dá para retirar ingredientes listados neste produto.' });
    return;
  }
  // Recipe order, so the kitchen always reads it the same way.
  summary.push(`Sem: ${listed.filter(i => removed.includes(i)).map(i => i.toLowerCase()).join(', ')}`);
}

function comboIssues(index: CatalogIndex, variant: Variant, combo: LineConfig['combo'], issues: LineIssue[], summary: string[]) {
  const groups = variant.comboGroups ?? [];
  const selections = combo ?? {};
  for (const key of Object.keys(selections)) {
    if (!groups.some(g => g.id === key)) issues.push({ field: 'combo', code: 'COMBO_GROUP_UNKNOWN', message: 'A escolha enviada não pertence a este combo.' });
  }
  for (const group of groups) {
    const chosen = Object.entries(selections[group.id] ?? {}).filter(([, qty]) => qty !== 0);
    let total = 0;
    const names: string[] = [];
    for (const [id, qty] of chosen) {
      if (!Number.isInteger(qty) || qty < 0) {
        issues.push({ field: 'combo', code: 'COMBO_QUANTITY_INVALID', groupId: group.id, message: 'Quantidade inválida no combo.' });
        continue;
      }
      if (!group.repeat && qty > 1) {
        issues.push({ field: 'combo', code: 'COMBO_REPEATED', groupId: group.id, message: `Em ${group.label.toLowerCase()}, cada opção pode ser escolhida uma vez.` });
      }
      const name = comboOptionName(index, group, id);
      const priced = group.source !== 'flavor' || !group.table || index.flavor(id)?.prices[group.table] !== undefined;
      if (!group.options.includes(id) || !name || !priced) {
        issues.push({ field: 'combo', code: 'COMBO_OPTION_UNAVAILABLE', groupId: group.id, message: `Uma escolha em ${group.label.toLowerCase()} não está disponível.` });
        continue;
      }
      total += qty;
      names.push(group.repeat ? `${qty}x ${name}` : name);
    }
    if (total < group.min) {
      issues.push({ field: 'combo', code: 'COMBO_INCOMPLETE', groupId: group.id, message: `${group.label}: ${plural(group.min - total, 'escolha restante', 'escolhas restantes')}.` });
    } else if (total > group.max) {
      issues.push({ field: 'combo', code: 'COMBO_EXCEEDED', groupId: group.id, message: `${group.label}: o limite é ${group.max}, remova ${total - group.max}.` });
    }
    if (names.length) summary.push(`${group.label}: ${names.join(', ')}`);
  }
}

/* Deterministic price of one cart line. The backend runs the same function and
   its result is the one that counts; the browser only uses it for instant feedback. */
export function quoteLine(index: CatalogIndex, config: LineConfig): LineQuote {
  const issues: LineIssue[] = [];
  const parts: PricePart[] = [];
  const summary: string[] = [];
  const product = index.product(config.productId);
  const variant = product?.variants.find(v => v.id === config.variantId);
  const base: LineQuote = {
    ok: false,
    productId: config.productId,
    variantId: config.variantId,
    name: product?.name ?? 'Produto indisponível',
    variantLabel: variant?.label ?? '',
    quantity: config.quantity,
    unitCents: null,
    totalCents: null,
    parts,
    summary,
    issues
  };
  if (!product) {
    issues.push({ field: 'product', code: 'PRODUCT_NOT_FOUND', message: 'Este produto não está mais no cardápio.' });
    return base;
  }
  if (!variant) {
    issues.push({ field: 'variant', code: 'VARIANT_NOT_FOUND', message: 'Este tamanho não está mais disponível.' });
    return base;
  }
  if (!Number.isInteger(config.quantity) || config.quantity < 1 || config.quantity > MAX_QUANTITY) {
    issues.push({ field: 'quantity', code: 'QUANTITY_INVALID', message: `A quantidade precisa estar entre 1 e ${MAX_QUANTITY}.` });
  }
  if ((config.note ?? '').length > MAX_NOTE) {
    issues.push({ field: 'note', code: 'NOTE_TOO_LONG', message: `A observação aceita até ${MAX_NOTE} caracteres.` });
  }

  const flavorIds = config.flavorIds ?? [];
  flavorIssues(index, variant, flavorIds, issues);

  const pricing = variant.pricing;
  if (pricing.type === 'fixed') {
    parts.push({ label: variantDisplayName(product, variant), cents: pricing.priceCents });
  } else if (pricing.type === 'fraction_sum') {
    const n = flavorIds.length;
    // Invalid flavors already explain the problem; pricing them would only add noise.
    if (n > 0 && !issues.some(i => i.field === 'flavors')) {
      for (const id of flavorIds) {
        const price = index.flavor(id)?.prices[pricing.table];
        if (price === undefined) {
          issues.push({ field: 'price', code: 'PRICE_UNAVAILABLE', message: 'Não há preço cadastrado para um dos sabores neste tamanho.' });
          continue;
        }
        const name = index.flavor(id)!.name;
        parts.push({ label: n === 1 ? name : `1/${n} ${name}`, cents: fraction(price, n) });
      }
    }
  } else {
    issues.push({ field: 'price', code: 'PRICING_POLICY_MISSING', message: 'O preço deste item precisa ser confirmado com a loja.' });
  }
  if (flavorIds.length && variant.flavors) {
    summary.push(`${flavorIds.length === 1 ? 'Sabor' : 'Sabores'}: ${flavorIds.map(id => index.flavor(id)?.name ?? id).join(', ')}`);
  }

  ingredientIssues(variant, config.removedIngredients ?? [], issues, summary);
  optionParts(index, variant, config.optionIds ?? [], issues, parts, summary);
  comboIssues(index, variant, config.combo, issues, summary);
  if (config.note?.trim()) summary.push(`Observação: ${config.note.trim()}`);

  if (issues.length) return base;
  const unit = parts.reduce((sum, p) => sum + p.cents, 0);
  return { ...base, ok: true, unitCents: unit, totalCents: unit * config.quantity };
}

/* Stable key so the same configuration is merged into one cart line. */
export function lineKey(config: LineConfig): string {
  const combo = Object.entries(config.combo ?? {})
    .map(([g, sel]) => [g, Object.entries(sel).filter(([, q]) => q > 0).sort(([a], [b]) => a.localeCompare(b))] as const)
    .filter(([, sel]) => sel.length)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([
    config.productId,
    config.variantId,
    config.flavorIds ?? [],
    [...(config.optionIds ?? [])].sort(),
    [...(config.removedIngredients ?? [])].sort(),
    combo,
    (config.note ?? '').trim()
  ]);
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function quoteCart(index: CatalogIndex, lines: LineConfig[], now = new Date()): Quote {
  const quoted = lines.map(line => quoteLine(index, line));
  const subtotal = quoted.reduce((sum, l) => sum + (l.totalCents ?? 0), 0);
  const complete = quoted.length > 0 && quoted.every(l => l.ok);
  return {
    id: `q_${hash(index.catalog.version + JSON.stringify(lines))}`,
    catalogVersion: index.catalog.version,
    currency: 'BRL',
    lines: quoted,
    subtotalCents: subtotal,
    deliveryCents: null,
    totalCents: subtotal,
    complete,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
    warnings: ['A taxa de entrega é informada pela loja na confirmação.']
  };
}
