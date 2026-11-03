import { defaultIndex, primaryImage } from '@bella/domain';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { EmptyState } from '../components/ui/EmptyState';
import { artKindFor } from '../components/ui/ProductArt';
import { ProductImage } from '../components/ui/ProductImage';
import { useCart } from '../features/cart/CartProvider';
import { ProductBuilder } from '../features/product-builder/ProductBuilder';
import { usePageTitle } from '../lib/hooks';

export default function ProductPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cart = useCart();
  const product = defaultIndex.productBySlug(slug);
  const editing = params.get('editar') ? cart.lines.find(l => l.id === params.get('editar') && l.config.productId === product?.id) : undefined;
  const [variantId, setVariantId] = useState(editing?.config.variantId ?? product?.variants[0]?.id ?? '');
  usePageTitle(product?.name ?? 'Produto não encontrado');

  if (!product) {
    return (
      <div className="container page">
        <EmptyState
          title="Não encontramos esse item"
          action={<Button type="primary" shape="round" onClick={() => navigate('/cardapio')}>Ver cardápio</Button>}
        >
          <p>Ele pode ter saído do cardápio ou o endereço está incompleto.</p>
        </EmptyState>
      </div>
    );
  }

  const variant = product.variants.find(v => v.id === variantId) ?? product.variants[0]!;
  const image = variant.image ?? primaryImage(product);
  const category = defaultIndex.catalog.categories.find(c => c.id === product.categoryIds[0]);
  const description = variant.description ?? product.summary;

  return (
    <div className="container page product-page">
      <nav className="crumbs" aria-label="Você está em">
        <Link to="/cardapio"><ArrowLeftOutlined /> Cardápio</Link>
        {category && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/cardapio?categoria=${category.id}`}>{category.name}</Link>
          </>
        )}
      </nav>
      <div className="product-layout">
        <div className="product-layout__media">
          <ProductImage key={image?.url ?? 'art'} image={image} art={artKindFor(product.categoryIds)} priority className="product-hero-image" />
        </div>
        <div className="product-layout__main">
          <header className="product-head">
            <h1 tabIndex={-1}>{product.name}</h1>
            {description && <p className="product-head__desc">{description}</p>}
            {variant.ingredients && variant.ingredients.length > 0 && (
              <ul className="ingredients" aria-label="Ingredientes">
                {variant.ingredients.map(i => <li key={i}>{i}</li>)}
              </ul>
            )}
          </header>
          <ProductBuilder
            key={`${product.id}-${editing?.id ?? 'new'}`}
            product={product}
            variant={variant}
            onVariant={setVariantId}
            initial={editing?.config}
            editingId={editing?.id}
          />
        </div>
      </div>
    </div>
  );
}
