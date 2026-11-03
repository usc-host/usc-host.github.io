import { defaultIndex, formatBRL, isDirectAdd, primaryImage, type LineQuote } from '@bella/domain';
import { DeleteOutlined, EditOutlined, ExclamationCircleOutlined, RedoOutlined } from '@ant-design/icons';
import { Button, Popconfirm } from 'antd';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import { BrandStatus } from '../components/brand/BrandLoader';
import { EmptyState } from '../components/ui/EmptyState';
import { artKindFor } from '../components/ui/ProductArt';
import { ProductImage } from '../components/ui/ProductImage';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { useCart, type CartLine } from '../features/cart/CartProvider';
import { useServerQuote } from '../features/cart/useServerQuote';
import { usePageTitle } from '../lib/hooks';

function LineItem({ line, preview, server }: { line: CartLine; preview?: LineQuote; server?: LineQuote }) {
  const cart = useCart();
  const product = defaultIndex.product(line.config.productId);
  const variant = product?.variants.find(v => v.id === line.config.variantId);
  const shown = server ?? preview;
  const unavailable = shown ? !shown.ok : true;
  const changed = server && preview && server.ok && preview.ok && server.unitCents !== preview.unitCents;
  const image = variant?.image ?? (product ? primaryImage(product) : null);

  return (
    <li className={`cart-line${unavailable ? ' is-unavailable' : ''}`}>
      <Link to={product ? `/produto/${product.slug}` : '/cardapio'} className="cart-line__media" tabIndex={-1} aria-hidden="true">
        <ProductImage image={image} art={artKindFor(product?.categoryIds ?? [])} />
      </Link>
      <div className="cart-line__body">
        <div className="cart-line__title">
          <h2>{shown?.name ?? 'Item indisponível'}</h2>
          {product && product.variants.length > 1 && <span className="tag">{variant?.label}</span>}
        </div>
        {shown && shown.summary.length > 0 && (
          <ul className="cart-line__summary">
            {shown.summary.map(s => <li key={s}>{s}</li>)}
          </ul>
        )}
        {unavailable && (
          <p className="cart-line__warn"><ExclamationCircleOutlined /> {shown?.issues[0]?.message ?? 'Este item não está mais disponível.'}</p>
        )}
        {changed && <p className="cart-line__note">Valor atualizado conforme o cardápio.</p>}
        <div className="cart-line__controls">
          <QuantityStepper size="sm" value={line.config.quantity} onChange={q => cart.setQuantity(line.id, q)} label={`Quantidade de ${shown?.name ?? 'item'}`} />
          <div className="cart-line__actions">
            {product && !isDirectAdd(product) && !unavailable && (
              <Link to={`/produto/${product.slug}?editar=${line.id}`} className="icon-text">
                <EditOutlined /> Editar
              </Link>
            )}
            <button type="button" className="icon-text icon-text--danger" onClick={() => { cart.remove(line.id); toast('Item removido', { id: `rm-${line.id}` }); }}>
              <DeleteOutlined /> Remover
            </button>
          </div>
        </div>
      </div>
      <span className="cart-line__price price">{shown?.totalCents != null ? formatBRL(shown.totalCents) : ''}</span>
    </li>
  );
}

export default function CartPage() {
  usePageTitle('Carrinho');
  const cart = useCart();
  const navigate = useNavigate();
  const server = useServerQuote(cart.lines);
  const notified = useRef<string | null>(null);

  const localTotal = cart.lines.reduce((sum, l) => sum + (cart.previews.get(l.id)?.totalCents ?? 0), 0);
  const fresh = server.status === 'ready' && server.quote.lines.length === cart.lines.length;
  const total = fresh ? server.quote!.totalCents : localTotal;
  const blocked = cart.lines.some((l, i) => !(fresh ? server.quote!.lines[i]?.ok : cart.previews.get(l.id)?.ok));

  // Tell the customer once when the API priced something differently.
  useEffect(() => {
    if (!fresh || !server.quote) return;
    if (server.quote.totalCents !== localTotal && notified.current !== server.quote.id) {
      notified.current = server.quote.id;
      toast('Alguns valores foram atualizados conforme o cardápio.', { id: 'price-update' });
    }
  }, [fresh, server.quote, localTotal]);

  if (!cart.lines.length) {
    return (
      <div className="container page">
        <EmptyState
          title="Seu carrinho está vazio"
          action={
            <div className="empty__buttons">
              <Button type="primary" shape="round" size="large" onClick={() => navigate('/cardapio')}>Ver cardápio</Button>
              <Button shape="round" size="large" onClick={() => navigate('/produto/pizza-grande')}>Montar uma pizza</Button>
            </div>
          }
        >
          <p>Que tal começar por uma das pizzas premium da casa?</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page">
      <header className="page-head page-head--row">
        <h1 tabIndex={-1}>Seu carrinho</h1>
        <Popconfirm title="Esvaziar o carrinho?" okText="Esvaziar" cancelText="Cancelar" onConfirm={cart.clear} placement="bottomRight">
          <Button type="text" icon={<DeleteOutlined />}>Esvaziar</Button>
        </Popconfirm>
      </header>
      <div className="cart-layout">
        <ul className="cart-lines" aria-label="Itens do carrinho">
          {cart.lines.map((line, i) => (
            <LineItem key={line.id} line={line} preview={cart.previews.get(line.id)} server={fresh ? server.quote!.lines[i] : undefined} />
          ))}
        </ul>
        <aside className="cart-summary" aria-label="Resumo">
          <h2>Resumo</h2>
          <dl>
            <div><dt>Itens</dt><dd className="price">{formatBRL(total)}</dd></div>
            <div><dt>Entrega</dt><dd className="muted">Informada pela loja</dd></div>
            <div className="cart-summary__total"><dt>Total dos itens</dt><dd className="price">{formatBRL(total)}</dd></div>
          </dl>
          <div className="cart-summary__status" aria-live="polite">
            {server.status === 'loading' && <BrandStatus label="Confirmando valores" />}
            {server.status === 'error' && (
              <div className="inline-error">
                <span>{server.message}</span>
                <Button size="small" shape="round" icon={<RedoOutlined />} onClick={server.retry}>Tentar de novo</Button>
              </div>
            )}
            {blocked && <span className="inline-warn">Remova os itens indisponíveis para continuar.</span>}
          </div>
          <div className="cart-summary__cta">
            <span className="cart-summary__cta-total price">{formatBRL(total)}</span>
            <Button type="primary" size="large" shape="round" block disabled={!fresh || blocked} onClick={() => navigate('/revisao')}>
              Revisar pedido
            </Button>
          </div>
          <Link to="/cardapio" className="text-link cart-summary__more">Continuar escolhendo</Link>
        </aside>
      </div>
    </div>
  );
}
