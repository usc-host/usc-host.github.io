import { catalog, defaultIndex, fromPriceCents, searchProducts, type Product } from '@bella/domain';
import { SearchOutlined } from '@ant-design/icons';
import { Button, Input, Select } from 'antd';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageNav } from '../components/layout/PageNav';
import { CategoryRail } from '../components/ui/CategoryRail';
import { EmptyState } from '../components/ui/EmptyState';
import { ProductCard } from '../components/ui/ProductCard';
import { useChat } from '../features/chat/ChatProvider';
import { usePageTitle } from '../lib/hooks';

type Sort = 'relevancia' | 'menor' | 'maior';

function sortProducts(list: Product[], sort: Sort) {
  if (sort === 'relevancia') return list;
  const price = (p: Product) => fromPriceCents(defaultIndex, p) ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) => (sort === 'menor' ? price(a) - price(b) : price(b) - price(a)));
}

/* Search, category and sort live in the query string: shareable, kept on
   back/forward, and they never count as a page change. */
export default function MenuPage() {
  usePageTitle('Cardápio');
  const [params, setParams] = useSearchParams();
  const chat = useChat();
  const category = params.get('categoria') ?? 'todos';
  const sort = (params.get('ordem') as Sort) ?? 'relevancia';
  const [query, setQuery] = useState(params.get('busca') ?? '');
  const deferred = useDeferredValue(query);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (deferred.trim()) next.set('busca', deferred.trim());
    else next.delete('busca');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [deferred, params, setParams]);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const categoryId = category === 'todos' ? undefined : category;
  const results = useMemo(
    () => sortProducts(searchProducts(defaultIndex, { query: deferred, categoryId }), sort),
    [deferred, categoryId, sort]
  );
  const grouped = !deferred.trim() && !categoryId && sort === 'relevancia';
  const tabs = [{ id: 'todos', label: 'Todos' }, ...catalog.categories.map(c => ({ id: c.id, label: c.name }))];
  const current = catalog.categories.find(c => c.id === categoryId);

  return (
    <div className="container page">
      <PageNav
        trail={[{ label: 'Início', to: '/' }, { label: 'Cardápio', to: current ? '/cardapio' : undefined }, ...(current ? [{ label: current.name }] : [])]}
        fallback="/"
      />
      <header className="page-head">
        <div>
          <span className="eyebrow">Cardápio</span>
          <h1 tabIndex={-1}>{current ? current.name : 'Tudo o que sai do nosso forno'}</h1>
          {current && <p className="muted page-head__lead">{current.description}</p>}
        </div>
      </header>

      <div className="menu-tools">
        <Input
          size="large"
          allowClear
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Buscar por nome ou ingrediente"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Buscar no cardápio"
          className="menu-tools__search"
        />
        <Select
          size="large"
          value={sort}
          onChange={value => update('ordem', value === 'relevancia' ? null : value)}
          aria-label="Ordenar"
          className="menu-tools__sort"
          options={[
            { value: 'relevancia', label: 'Destaques' },
            { value: 'menor', label: 'Menor preço' },
            { value: 'maior', label: 'Maior preço' }
          ]}
        />
      </div>

      <div className="menu-rail">
        <CategoryRail items={tabs} active={category} onSelect={id => update('categoria', id === 'todos' ? null : id)} label="Categorias" />
      </div>

      <p className="sr-only" aria-live="polite">{results.length} {results.length === 1 ? 'item encontrado' : 'itens encontrados'}</p>

      {results.length === 0 ? (
        <EmptyState
          title={deferred ? `Nada encontrado para "${deferred}"` : 'Nenhum item nesta categoria'}
          action={
            <div className="empty__buttons">
              <Button shape="round" onClick={() => { setQuery(''); update('categoria', null); }}>Limpar busca</Button>
              <Button type="primary" shape="round" onClick={() => chat.send(deferred ? `Tem algo com ${deferred}?` : 'Me ajuda a escolher')}>
                Perguntar ao assistente
              </Button>
            </div>
          }
        >
          <p>Tente outro ingrediente ou peça uma sugestão ao nosso assistente.</p>
        </EmptyState>
      ) : grouped ? (
        catalog.categories.map(c => {
          const items = results.filter(p => p.categoryIds[0] === c.id);
          if (!items.length) return null;
          return (
            <section key={c.id} className="menu-section" aria-labelledby={`cat-${c.id}`}>
              <div className="menu-section__head">
                <h2 id={`cat-${c.id}`}>{c.name}</h2>
                <p className="muted">{c.description}</p>
              </div>
              <div className="product-grid">
                {items.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          );
        })
      ) : (
        <div className="product-grid menu-results">
          {results.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
