import {
  comboOptionName,
  defaultIndex,
  formatBRL,
  isBaseIngredient,
  MAX_NOTE,
  primaryImage,
  quoteLine,
  variantFromPrice,
  type ComboGroup,
  type LineConfig,
  type LineQuote,
  type OptionGroup,
  type Product,
  type Variant
} from '@bella/domain';
import { CheckOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons';
import { Button, Input, Modal } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { artKindFor } from '../../components/ui/ProductArt';
import { imagesForFlavors, PizzaSplitImage } from '../../components/ui/PizzaSplitImage';
import { ProductImage } from '../../components/ui/ProductImage';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { asset } from '../../lib/asset';
import { useCart } from '../cart/CartProvider';
import { FlavorPreview } from './FlavorPreview';

const index = defaultIndex;

function Counter({ value, max, noun }: { value: number; max: number; noun: [string, string] }) {
  return (
    <span className={`counter${value === max ? ' is-full' : ''}`} aria-live="polite">
      {value} de {max} {max === 1 ? noun[0] : noun[1]}
    </span>
  );
}

function Required() {
  return <span className="required">obrigatório</span>;
}

/* A choice with an eye button on the far right that opens the flavor photo.
   Two sibling buttons, since a button cannot hold another one. */
function FlavorChoice({ name, selected, full, single, extra, onToggle, onPreview, onFull }: {
  name: string;
  selected: boolean;
  full: boolean;
  single: boolean;
  extra?: React.ReactNode;
  onToggle: () => void;
  onPreview: () => void;
  onFull: () => void;
}) {
  return (
    <div className={`choice-row choice-row--split${selected ? ' is-selected' : ''}${full ? ' is-full' : ''}`}>
      <button
        type="button"
        className="choice-row__main"
        role={single ? 'radio' : undefined}
        aria-checked={single ? selected : undefined}
        aria-pressed={single ? undefined : selected}
        aria-disabled={full}
        onClick={() => (full ? onFull() : onToggle())}
      >
        <span className={single ? 'choice-row__radio' : 'choice-row__check'} aria-hidden="true">{!single && selected && <CheckOutlined />}</span>
        <span className="choice-row__name">{name}</span>
        {extra}
      </button>
      <button type="button" className="choice-row__eye" onClick={onPreview} aria-label={`Ver foto de ${name}`} title="Ver foto">
        <EyeOutlined />
      </button>
    </div>
  );
}

function Thumb({ src, alt }: { src?: string; alt: string }) {
  return src ? <img className="choice-row__thumb" src={asset(src)} alt={alt} width={44} height={44} loading="lazy" /> : null;
}

/* A note example that fits what is being ordered. */
function notePlaceholder(product: Product): string {
  if (product.categoryIds.includes('bebidas')) return 'Ex.: bem gelada';
  if (product.categoryIds.includes('esfihas')) return 'Ex.: bem assadas';
  return 'Ex.: bem assada, cortar em 12 pedaços';
}

interface Props {
  product: Product;
  variant: Variant | null;
  onVariant: (id: string) => void;
  initial?: LineConfig;
  editingId?: string;
  /* Lets the page redraw the pizza photo with the chosen flavors. */
  onFlavorsChange?: (ids: string[]) => void;
}

export function ProductBuilder({ product, variant, onVariant, initial, editingId, onFlavorsChange }: Props) {
  const cart = useCart();
  const navigate = useNavigate();
  const [flavorIds, setFlavorIds] = useState<string[]>(initial?.flavorIds ?? []);
  const [optionIds, setOptionIds] = useState<string[]>(initial?.optionIds ?? []);
  const [removed, setRemoved] = useState<string[]>(initial?.removedIngredients ?? []);
  const [combo, setCombo] = useState<Record<string, Record<string, number>>>(initial?.combo ?? {});
  const [note, setNote] = useState(initial?.note ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [added, setAdded] = useState<LineQuote | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    onFlavorsChange?.(flavorIds);
  }, [flavorIds, onFlavorsChange]);

  const choosable = product.variants.length > 1;
  const variantLabel = product.variantLabel ?? 'Tamanho';
  // Pizzas share the recipe across sizes, so ingredients and extras can be
  // shown before the size is picked. Built pizzas wait for the size.
  const shown = variant ?? (product.kind === 'builder' ? null : product.variants[0] ?? null);
  const rule = variant?.flavors;
  const groups = (shown?.optionGroupIds ?? []).map(id => index.optionGroup(id)).filter((g): g is OptionGroup => !!g);
  const ingredients = shown?.ingredients ?? [];

  function changeVariant(id: string) {
    const next = product.variants.find(v => v.id === id);
    if (!next) return;
    setFlavorIds(list => list.filter(f => next.flavors?.options.includes(f)).slice(0, next.flavors?.max ?? 0));
    setOptionIds(list => list.filter(o => (next.optionGroupIds ?? []).some(g => index.optionGroup(g)?.options.some(opt => opt.id === o))));
    setRemoved(list => list.filter(r => next.ingredients?.includes(r)));
    setCombo({});
    onVariant(id);
  }

  const config: LineConfig | null = useMemo(() => variant && ({
    productId: product.id,
    variantId: variant.id,
    quantity,
    ...(flavorIds.length ? { flavorIds } : {}),
    ...(optionIds.length ? { optionIds } : {}),
    ...(removed.length ? { removedIngredients: removed } : {}),
    ...(Object.keys(combo).length ? { combo } : {}),
    ...(note.trim() ? { note: note.trim() } : {})
  }), [product.id, variant, quantity, flavorIds, optionIds, removed, combo, note]);

  const quote = useMemo(() => (config ? quoteLine(index, config) : null), [config]);
  const blocking = !variant ? `Escolha ${variantLabel === 'Tamanho' ? 'o tamanho' : variantLabel === 'Bebida' ? 'a bebida' : 'o sabor'}.` : quote?.issues[0]?.message;

  function toggleFlavor(id: string) {
    if (!rule) return;
    setFlavorIds(list => {
      if (list.includes(id)) return list.filter(f => f !== id);
      if (rule.max === 1) return [id];
      if (list.length >= rule.max) return list;
      return [...list, id];
    });
  }

  function toggleOption(group: OptionGroup, id: string) {
    setOptionIds(list => {
      const inGroup = list.filter(o => group.options.some(opt => opt.id === o));
      if (list.includes(id)) return list.filter(o => o !== id);
      if (group.max === 1) return [...list.filter(o => !inGroup.includes(o)), id];
      if (inGroup.length >= group.max) {
        toast(`Escolha até ${group.max} em ${group.name.toLowerCase()}.`, { id: 'option-limit' });
        return list;
      }
      return [...list, id];
    });
  }

  function setChoice(group: ComboGroup, id: string, qty: number) {
    setCombo(current => {
      const selection = { ...(current[group.id] ?? {}) };
      if (!group.repeat && group.max === 1) {
        return { ...current, [group.id]: qty > 0 ? { [id]: 1 } : {} };
      }
      const others = Object.entries(selection).filter(([key]) => key !== id).reduce((s, [, q]) => s + q, 0);
      const capped = Math.max(0, Math.min(qty, group.max - others));
      if (capped === 0) delete selection[id];
      else selection[id] = capped;
      return { ...current, [group.id]: selection };
    });
  }

  function submit() {
    if (!config || !quote?.ok) return;
    if (editingId) {
      cart.replace(editingId, config);
      toast.success('Item atualizado', { id: `edit-${editingId}` });
      navigate('/carrinho');
      return;
    }
    cart.add(config);
    setAdded(quote);
    setQuantity(1);
  }

  const modalImage = variant?.image ?? primaryImage(product);

  return (
    <div className="builder">
      {choosable && (
        <fieldset className="builder__section">
          <legend>{variantLabel}<Required /></legend>
          {variantLabel === 'Tamanho' ? (
            <div className="choice-grid choice-grid--sizes">
              {product.variants.map(v => {
                const from = variantFromPrice(index, v);
                const selected = v.id === variant?.id;
                return (
                  <button key={v.id} type="button" className={`choice${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => changeVariant(v.id)}>
                    <span className="choice__title">{v.label}</span>
                    {v.slices && <span className="choice__meta">{v.slices} pedaços</span>}
                    {from !== null && <span className="price">{product.kind === 'builder' ? `a partir de ${formatBRL(from)}` : formatBRL(from)}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="choice-list" role="radiogroup" aria-label={variantLabel}>
              {product.variants.map(v => {
                const selected = v.id === variant?.id;
                const from = variantFromPrice(index, v);
                return (
                  <button key={v.id} type="button" role="radio" aria-checked={selected} className={`choice-row${selected ? ' is-selected' : ''}`} onClick={() => changeVariant(v.id)}>
                    <span className="choice-row__radio" aria-hidden="true" />
                    <Thumb src={v.image?.url} alt="" />
                    <span className="choice-row__name">{v.label}</span>
                    {from !== null && <span className="choice-row__price">{formatBRL(from)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      {product.kind === 'builder' && !variant && (
        <p className="builder__wait">Escolha o tamanho para ver os sabores e as bordas.</p>
      )}

      {rule && (
        <fieldset className="builder__section">
          <legend>
            Sabores
            <Counter value={flavorIds.length} max={rule.max} noun={['sabor', 'sabores']} />
          </legend>
          <p className="builder__hint">
            {rule.max === 1 ? 'Escolha 1 sabor.' : `Escolha de ${rule.min} a ${rule.max} sabores. Cada um ocupa uma fração igual da pizza.`}
          </p>
          <div className="choice-list">
            {rule.options.map(id => {
              const flavor = index.flavor(id);
              if (!flavor) return null;
              const selected = flavorIds.includes(id);
              const full = !selected && rule.max > 1 && flavorIds.length >= rule.max;
              const price = flavor.prices[rule.table];
              return (
                <FlavorChoice
                  key={id}
                  name={flavor.name}
                  selected={selected}
                  full={full}
                  single={false}
                  onToggle={() => toggleFlavor(id)}
                  onFull={() => toast(`Limite de ${rule.max} sabores. Remova um para trocar.`, { id: 'flavor-limit' })}
                  onPreview={() => setPreview(id)}
                  extra={
                    <>
                      {flavor.kind === 'doce' && <span className="tag tag--sweet">doce</span>}
                      {price !== undefined && <span className="choice-row__price">{formatBRL(price)}</span>}
                    </>
                  }
                />
              );
            })}
          </div>
        </fieldset>
      )}

      {ingredients.length > 0 && (
        <fieldset className="builder__section">
          <legend>Ingredientes<span className="optional">toque para retirar</span></legend>
          <div className="choice-list">
            {ingredients.map(name => {
              const base = isBaseIngredient(name);
              const included = !removed.includes(name);
              return base ? (
                <div key={name} className="choice-row is-selected is-locked">
                  <span className="choice-row__check" aria-hidden="true"><CheckOutlined /></span>
                  <span className="choice-row__name">{name}</span>
                  <span className="choice-row__lock"><LockOutlined /> faz parte da receita</span>
                </div>
              ) : (
                <button
                  key={name}
                  type="button"
                  className={`choice-row${included ? ' is-selected' : ' is-removed'}`}
                  aria-pressed={included}
                  onClick={() => setRemoved(list => (included ? [...list, name] : list.filter(r => r !== name)))}
                >
                  <span className="choice-row__check" aria-hidden="true">{included && <CheckOutlined />}</span>
                  <span className="choice-row__name">{name}</span>
                  {!included && <span className="choice-row__price">sem</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {groups.map(group => {
        const chosen = group.options.filter(o => optionIds.includes(o.id));
        const single = group.max === 1;
        return (
          <fieldset key={group.id} className="builder__section">
            <legend>
              {group.name}
              {single ? group.min === 0 && <span className="optional">opcional</span> : <Counter value={chosen.length} max={group.max} noun={['item', 'itens']} />}
            </legend>
            <div className="choice-list" role={single ? 'radiogroup' : undefined} aria-label={group.name}>
              {single && group.min === 0 && (
                <button type="button" role="radio" aria-checked={!chosen.length} className={`choice-row${!chosen.length ? ' is-selected' : ''}`} onClick={() => setOptionIds(list => list.filter(o => !group.options.some(opt => opt.id === o)))}>
                  <span className="choice-row__radio" aria-hidden="true" />
                  <span className="choice-row__name">Sem {group.name.toLowerCase()}</span>
                </button>
              )}
              {group.options.map(o => {
                const selected = optionIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role={single ? 'radio' : undefined}
                    aria-checked={single ? selected : undefined}
                    aria-pressed={single ? undefined : selected}
                    className={`choice-row${selected ? ' is-selected' : ''}`}
                    onClick={() => toggleOption(group, o.id)}
                  >
                    <span className={single ? 'choice-row__radio' : 'choice-row__check'} aria-hidden="true">{!single && selected && <CheckOutlined />}</span>
                    <span className="choice-row__name">{o.name}</span>
                    <span className="choice-row__price">+ {formatBRL(o.priceCents)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {variant?.comboGroups?.map(group => {
        const selection = combo[group.id] ?? {};
        const total = Object.values(selection).reduce((s, q) => s + q, 0);
        const single = !group.repeat && group.max === 1;
        const name = (id: string) => comboOptionName(index, group, id) ?? id;
        const thumb = (id: string) => (group.source === 'item' ? index.item(id)?.variant.image?.url : undefined);
        return (
          <fieldset key={group.id} className="builder__section">
            <legend>
              {group.label}
              <Counter value={total} max={group.max} noun={group.source === 'flavor' ? ['sabor', 'sabores'] : ['item', 'itens']} />
            </legend>
            <p className="builder__hint">{group.hint}{group.repeat ? ', pode repetir.' : '.'}</p>
            <div className="choice-list" role={single ? 'radiogroup' : undefined} aria-label={group.label}>
              {group.options.map(id => {
                const qty = selection[id] ?? 0;
                if (group.repeat) {
                  return (
                    <div key={id} className={`choice-row choice-row--qty${qty ? ' is-selected' : ''}`}>
                      <Thumb src={thumb(id)} alt="" />
                      <span className="choice-row__name">{name(id)}</span>
                      {group.max >= 20 && (
                        <button type="button" className="mini-chip" onClick={() => setChoice(group, id, qty + 5)} disabled={total >= group.max}>+5</button>
                      )}
                      <QuantityStepper size="sm" min={0} max={qty + (group.max - total)} value={qty} onChange={v => setChoice(group, id, v)} label={name(id)} />
                    </div>
                  );
                }
                const selected = qty > 0;
                const full = !selected && !single && total >= group.max;
                if (group.source === 'flavor') {
                  return (
                    <FlavorChoice
                      key={id}
                      name={name(id)}
                      selected={selected}
                      full={full}
                      single={single}
                      onToggle={() => setChoice(group, id, selected ? 0 : 1)}
                      onFull={() => toast(`Limite de ${group.max}. Remova um para trocar.`, { id: 'combo-limit' })}
                      onPreview={() => setPreview(id)}
                    />
                  );
                }
                return (
                  <button
                    key={id}
                    type="button"
                    role={single ? 'radio' : undefined}
                    aria-checked={single ? selected : undefined}
                    aria-pressed={single ? undefined : selected}
                    aria-disabled={full}
                    className={`choice-row${selected ? ' is-selected' : ''}`}
                    onClick={() => (full ? toast(`Limite de ${group.max}. Remova um para trocar.`, { id: 'combo-limit' }) : setChoice(group, id, selected ? 0 : 1))}
                  >
                    <span className={single ? 'choice-row__radio' : 'choice-row__check'} aria-hidden="true">{!single && selected && <CheckOutlined />}</span>
                    <Thumb src={thumb(id)} alt="" />
                    <span className="choice-row__name">{name(id)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <fieldset className="builder__section">
        <legend>Observação<span className="optional">opcional</span></legend>
        <Input.TextArea
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={MAX_NOTE}
          showCount
          autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder={notePlaceholder(product)}
          aria-label="Observação para a cozinha"
        />
      </fieldset>

      <div className="builder__summary" aria-live="polite">
        <h2 className="builder__summary-title">Resumo</h2>
        {quote && quote.parts.length > 0 ? (
          <>
            <ul className="summary-lines">
              {quote.parts.map((p, i) => (
                <li key={i}><span>{p.label}</span><span className="price">{formatBRL(p.cents)}</span></li>
              ))}
              {quantity > 1 && quote.unitCents !== null && (
                <li className="summary-lines__qty"><span>{quantity} unidades</span><span className="price">{quantity} x {formatBRL(quote.unitCents)}</span></li>
              )}
            </ul>
            {quote.summary.filter(s => s.startsWith('Sem:')).map(s => <p key={s} className="summary-note">{s}</p>)}
          </>
        ) : (
          <p className="muted">{variant ? 'Faça suas escolhas para ver o valor.' : blocking}</p>
        )}
        {note.trim() && <p className="summary-note">Observação: {note.trim()}</p>}
      </div>

      <div className="builder-bar">
        <QuantityStepper value={quantity} onChange={setQuantity} label="Quantidade" />
        <div className="builder-bar__action">
          {!quote?.ok && blocking && <span className="builder-bar__hint">{blocking}</span>}
          <Button type="primary" size="large" shape="round" block disabled={!quote?.ok} onClick={submit}>
            <span className="builder-bar__label">
              {editingId ? <>Salvar<span className="builder-bar__long"> alterações</span></> : <>Adicionar<span className="builder-bar__long"> ao carrinho</span></>}
            </span>
            {quote?.totalCents != null && <span className="builder-bar__total">{formatBRL(quote.totalCents)}</span>}
          </Button>
        </div>
      </div>

      <Modal
        open={!!added}
        onCancel={() => setAdded(null)}
        footer={null}
        centered
        width={440}
        className="added-modal"
        title={null}
        destroyOnHidden
      >
        {added && (
          <div className="added">
            <span className="added__check" aria-hidden="true"><CheckOutlined /></span>
            <h2 className="added__title">Adicionado ao carrinho</h2>
            <div className="added__item">
              {product.kind === 'builder' && config?.flavorIds?.length ? (
                <PizzaSplitImage images={imagesForFlavors(config.flavorIds)} alt={added.name} className="added__image" />
              ) : (
                <ProductImage image={modalImage} art={artKindFor(product.categoryIds)} className="added__image" />
              )}
              <div>
                <strong>{added.quantity}x {added.name}</strong>
                {added.variantLabel && product.variants.length > 1 && <span className="muted"> {added.variantLabel}</span>}
                {added.summary.length > 0 && <ul>{added.summary.map(s => <li key={s}>{s}</li>)}</ul>}
                {added.totalCents != null && <span className="price">{formatBRL(added.totalCents)}</span>}
              </div>
            </div>
            <div className="added__actions">
              <Button size="large" shape="round" onClick={() => { setAdded(null); navigate('/cardapio'); }}>Continuar comprando</Button>
              <Button type="primary" size="large" shape="round" onClick={() => { setAdded(null); navigate('/carrinho'); }}>Ir para o carrinho</Button>
            </div>
          </div>
        )}
      </Modal>
      <FlavorPreview flavorId={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
