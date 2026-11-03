import {
  defaultIndex,
  formatBRL,
  MAX_NOTE,
  quoteLine,
  variantFromPrice,
  type ComboGroup,
  type LineConfig,
  type Product,
  type Variant
} from '@bella/domain';
import { CheckOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { useCart } from '../cart/CartProvider';

const index = defaultIndex;

function optionName(group: ComboGroup, id: string) {
  return group.pick === 'flavor' ? index.flavor(id)?.name ?? id : index.product(id)?.name ?? id;
}

function Counter({ value, max, noun }: { value: number; max: number; noun: [string, string] }) {
  return (
    <span className={`counter${value === max ? ' is-full' : ''}`} aria-live="polite">
      {value} de {max} {max === 1 ? noun[0] : noun[1]}
    </span>
  );
}

interface Props {
  product: Product;
  variant: Variant;
  onVariant: (id: string) => void;
  initial?: LineConfig;
  editingId?: string;
}

export function ProductBuilder({ product, variant, onVariant, initial, editingId }: Props) {
  const cart = useCart();
  const navigate = useNavigate();
  const [flavorIds, setFlavorIds] = useState<string[]>(initial?.flavorIds ?? []);
  const [optionIds, setOptionIds] = useState<string[]>(initial?.optionIds ?? []);
  const [combo, setCombo] = useState<Record<string, Record<string, number>>>(initial?.combo ?? {});
  const [note, setNote] = useState(initial?.note ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);

  const rule = variant.flavors;
  const groups = (variant.optionGroupIds ?? []).map(id => index.optionGroup(id)).filter(g => !!g);

  // Changing size keeps only the choices the new size accepts.
  function changeVariant(id: string) {
    const next = product.variants.find(v => v.id === id);
    if (!next) return;
    setFlavorIds(list => list.filter(f => next.flavors?.options.includes(f)).slice(0, next.flavors?.max ?? 0));
    setOptionIds(list => list.filter(o => (next.optionGroupIds ?? []).some(g => index.optionGroup(g)?.options.some(opt => opt.id === o))));
    setCombo({});
    onVariant(id);
  }

  const config: LineConfig = useMemo(() => ({
    productId: product.id,
    variantId: variant.id,
    quantity,
    ...(flavorIds.length ? { flavorIds } : {}),
    ...(optionIds.length ? { optionIds } : {}),
    ...(Object.keys(combo).length ? { combo } : {}),
    ...(note.trim() ? { note: note.trim() } : {})
  }), [product.id, variant.id, quantity, flavorIds, optionIds, combo, note]);

  const quote = useMemo(() => quoteLine(index, config), [config]);
  const blocking = quote.issues[0];

  function toggleFlavor(id: string) {
    if (!rule) return;
    setFlavorIds(list => {
      if (list.includes(id)) return list.filter(f => f !== id);
      if (rule.max === 1) return [id];
      if (list.length >= rule.max) return list;
      return [...list, id];
    });
  }

  function setChoice(group: ComboGroup, id: string, qty: number) {
    setCombo(current => {
      const selection = { ...(current[group.id] ?? {}) };
      if (group.pick !== 'quantity' && group.max === 1) {
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
    if (!quote.ok) return;
    if (editingId) {
      cart.replace(editingId, config);
      toast.success('Item atualizado', { id: `edit-${editingId}` });
      navigate('/carrinho');
      return;
    }
    cart.add(config);
    toast.success(`${product.name} no carrinho`, { id: `add-${product.id}-${Date.now()}` });
    setQuantity(1);
    setNote('');
  }

  return (
    <div className="builder">
      {product.variants.length > 1 && (
        <fieldset className="builder__section">
          <legend>Tamanho</legend>
          <div className="choice-grid choice-grid--sizes">
            {product.variants.map(v => {
              const from = variantFromPrice(index, v);
              const selected = v.id === variant.id;
              return (
                <button key={v.id} type="button" className={`choice${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => changeVariant(v.id)}>
                  <span className="choice__title">{v.label}</span>
                  {v.slices && <span className="choice__meta">{v.slices} pedaços</span>}
                  {from !== null && <span className="price">{formatBRL(from)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
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
                <button
                  key={id}
                  type="button"
                  className={`choice-row${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  aria-disabled={full}
                  onClick={() => (full ? toast(`Limite de ${rule.max} sabores. Remova um para trocar.`, { id: 'flavor-limit' }) : toggleFlavor(id))}
                >
                  <span className="choice-row__check" aria-hidden="true">{selected && <CheckOutlined />}</span>
                  <span className="choice-row__name">
                    {flavor.name}
                    {flavor.kind === 'doce' && <span className="tag tag--sweet">doce</span>}
                  </span>
                  {price !== undefined && <span className="choice-row__price">{formatBRL(price)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {groups.map(group => {
        const chosen = group.options.find(o => optionIds.includes(o.id));
        const pick = (id: string | null) =>
          setOptionIds(list => [...list.filter(o => !group.options.some(opt => opt.id === o)), ...(id ? [id] : [])]);
        return (
          <fieldset key={group.id} className="builder__section">
            <legend>{group.name}{group.min === 0 && <span className="optional">opcional</span>}</legend>
            <div className="choice-list" role="radiogroup" aria-label={group.name}>
              {group.min === 0 && (
                <button type="button" role="radio" aria-checked={!chosen} className={`choice-row${!chosen ? ' is-selected' : ''}`} onClick={() => pick(null)}>
                  <span className="choice-row__radio" aria-hidden="true" />
                  <span className="choice-row__name">Sem {group.name.toLowerCase()}</span>
                </button>
              )}
              {group.options.map(o => (
                <button key={o.id} type="button" role="radio" aria-checked={chosen?.id === o.id} className={`choice-row${chosen?.id === o.id ? ' is-selected' : ''}`} onClick={() => pick(o.id)}>
                  <span className="choice-row__radio" aria-hidden="true" />
                  <span className="choice-row__name">{o.name}</span>
                  <span className="choice-row__price">+ {formatBRL(o.priceCents)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}

      {variant.comboGroups?.map(group => {
        const selection = combo[group.id] ?? {};
        const total = Object.values(selection).reduce((s, q) => s + q, 0);
        const single = group.pick !== 'quantity' && group.max === 1;
        return (
          <fieldset key={group.id} className="builder__section">
            <legend>
              {group.label}
              <Counter value={total} max={group.max} noun={group.pick === 'flavor' ? ['sabor', 'sabores'] : ['item', 'itens']} />
            </legend>
            <p className="builder__hint">{group.hint}{group.pick === 'quantity' ? ', pode repetir.' : '.'}</p>
            <div className="choice-list" role={single ? 'radiogroup' : undefined} aria-label={group.label}>
              {group.options.map(id => {
                const qty = selection[id] ?? 0;
                if (group.pick === 'quantity') {
                  return (
                    <div key={id} className={`choice-row choice-row--qty${qty ? ' is-selected' : ''}`}>
                      <span className="choice-row__name">{optionName(group, id)}</span>
                      {group.max >= 20 && (
                        <button type="button" className="mini-chip" onClick={() => setChoice(group, id, qty + 5)} disabled={total >= group.max}>+5</button>
                      )}
                      <QuantityStepper size="sm" min={0} max={qty + (group.max - total)} value={qty} onChange={v => setChoice(group, id, v)} label={optionName(group, id)} />
                    </div>
                  );
                }
                const selected = qty > 0;
                const full = !selected && !single && total >= group.max;
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
                    <span className="choice-row__name">{optionName(group, id)}</span>
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
          placeholder="Ex.: sem cebola, bem assada"
          aria-label="Observação para a cozinha"
        />
      </fieldset>

      <div className="builder__summary" aria-live="polite">
        <h2 className="builder__summary-title">Resumo</h2>
        {quote.parts.length > 0 ? (
          <ul className="summary-lines">
            {quote.parts.map((p, i) => (
              <li key={i}><span>{p.label}</span><span className="price">{formatBRL(p.cents)}</span></li>
            ))}
            {quantity > 1 && quote.unitCents !== null && (
              <li className="summary-lines__qty"><span>{quantity} unidades</span><span className="price">{quantity} x {formatBRL(quote.unitCents)}</span></li>
            )}
          </ul>
        ) : (
          <p className="muted">Faça suas escolhas para ver o valor.</p>
        )}
        {note.trim() && <p className="summary-note">Observação: {note.trim()}</p>}
      </div>

      <div className="builder-bar">
        <QuantityStepper value={quantity} onChange={setQuantity} label="Quantidade" />
        <div className="builder-bar__action">
          {!quote.ok && blocking && <span className="builder-bar__hint">{blocking.message}</span>}
          <Button type="primary" size="large" shape="round" block disabled={!quote.ok} onClick={submit}>
            {editingId ? 'Salvar alterações' : 'Adicionar'}
            {quote.totalCents !== null && <span className="builder-bar__total">{formatBRL(quote.totalCents)}</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
