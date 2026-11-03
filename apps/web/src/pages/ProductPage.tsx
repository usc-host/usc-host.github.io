import { defaultIndex, primaryImage } from '@bella/domain';
import { Button } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PageNav } from '../components/layout/PageNav';
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
  // Size, flavor or drink is always an explicit choice when there is more than one.
  const [variantId, setVariantId] = useState<string | null>(() => {
    if (!product) return null;
    if (editing) return editing.config.variantId;
    if (product.variants.length === 1) return product.variants[0]!.id;
    const asked = params.get('tamanho');
    return product.variants.some(v => v.id === asked) ? asked : null;
  });
  usePageTitle(product?.name ?? 'Produto não encontrado');

  if (!product) {
    return (
      <div className="container page">
        <PageNav trail={[{ label: 'Início', to: '/' }, { label: 'Cardápio', to: '/cardapio' }, { label: 'Não encontrado' }]} fallback="/cardapio" />
        <EmptyState
          title="Não encontramos esse item"
          action={<Button type="primary" shape="round" onClick={() => navigate('/cardapio')}>Ver cardápio</Button>}
        >
          <p>Ele pode ter saído do cardápio ou o endereço está incompleto.</p>
        </EmptyState>
      </div>
    );
  }

  const variant = product.variants.find(v => v.id === variantId) ?? null;
  const image = variant?.image ?? primaryImage(product);
  const category = defaultIndex.catalog.categories.find(c => c.id === product.categoryIds[0]);
  const description = (variant ?? product.variants[0])?.description ?? product.summary;

  return (
    <div className="container page product-page">
      <PageNav
        trail={[
          { label: 'Início', to: '/' },
          { label: 'Cardápio', to: '/cardapio' },
          ...(category ? [{ label: category.name, to: `/cardapio?categoria=${category.id}` }] : []),
          { label: product.name }
        ]}
        fallback={category ? `/cardapio?categoria=${category.id}` : '/cardapio'}
      />
      <div className="product-layout">
        <div className="product-layout__media">
          <ProductImage key={image?.url ?? 'art'} image={image} art={artKindFor(product.categoryIds)} priority className="product-hero-image" />
        </div>
        <div className="product-layout__main">
          <header className="product-head">
            {product.badge && <span className="badge-new">{product.badge}</span>}
            <h1 tabIndex={-1}>{product.name}</h1>
            {description && <p className="product-head__desc">{description}</p>}
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
