import { defaultIndex, formatBRL, fromPriceCents, isDirectAdd, primaryImage, productDescription, quoteLine, type Product } from '@bella/domain';
import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { useCart } from '../../features/cart/CartProvider';
import { artKindFor } from './ProductArt';
import { useRandomFlavorImage } from './PizzaSplitImage';
import { ProductImage } from './ProductImage';

const categoryName = (id: string) => defaultIndex.catalog.categories.find(c => c.id === id)?.name ?? '';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const cart = useCart();
  const housePizza = useRandomFlavorImage();
  const from = fromPriceCents(defaultIndex, product);
  const direct = isDirectAdd(product);
  const variable = product.variants.length > 1 || product.kind === 'builder';
  const href = `/produto/${product.slug}`;
  const label = product.variantLabel ?? 'Tamanho';
  const meta = product.variants.length < 2 ? null
    : label === 'Tamanho' ? product.variants.map(v => v.label).join(' ou ')
    : `${product.variants.length} ${label === 'Sabor' ? 'sabores' : 'opções'}`;

  function addNow() {
    const variant = product.variants[0]!;
    const config = { productId: product.id, variantId: variant.id, quantity: 1 };
    if (!quoteLine(defaultIndex, config).ok) return;
    cart.add(config);
    toast.success(`${product.name} no carrinho`, { id: `add-${product.id}` });
  }

  return (
    <article className="product-card">
      <Link to={href} className="product-card__media" tabIndex={-1} aria-hidden="true">
        <ProductImage image={primaryImage(product) ?? (product.kind === 'builder' ? housePizza : null)} art={artKindFor(product.categoryIds)} priority={priority} />
        <span className={`product-card__tag${product.badge ? ' is-new' : ''}`}>{product.badge ?? categoryName(product.categoryIds[0] ?? '')}</span>
      </Link>
      <div className="product-card__body">
        <h3>
          <Link to={href}>{product.name}</Link>
        </h3>
        <p className="product-card__desc">{productDescription(product)}</p>
        {meta && <p className="product-card__meta">{meta}</p>}
        <div className="product-card__foot">
          <span className="product-card__price">
            {from !== null ? (
              <>
                {variable && <small>a partir de</small>}
                <span className="price">{formatBRL(from)}</span>
              </>
            ) : (
              <small>Consulte</small>
            )}
          </span>
          {direct ? (
            <button type="button" className="round-action" onClick={addNow} aria-label={`Adicionar ${product.name} ao carrinho`}>
              <PlusOutlined />
            </button>
          ) : (
            <Link to={href} className="round-action round-action--ghost" aria-label={`Escolher ${product.name}`}>
              <ArrowRightOutlined />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
