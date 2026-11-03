import { catalog } from '@bella/domain';
import { ProductCard } from '../components/ui/ProductCard';
import { usePageTitle } from '../lib/hooks';

export default function CombosPage() {
  usePageTitle('Combos');
  const combos = catalog.products.filter(p => p.categoryIds.includes('combos'));
  const pizzas = combos.filter(p => !p.categoryIds.includes('esfihas'));
  const esfihas = combos.filter(p => p.categoryIds.includes('esfihas'));
  return (
    <div className="container page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Combos</span>
          <h1 tabIndex={-1}>Tudo junto, por um valor fechado</h1>
          <p className="muted page-head__lead">Escolha os sabores de cada parte do combo. O valor não muda com as suas escolhas.</p>
        </div>
      </header>
      <section className="menu-section" aria-labelledby="combos-pizza">
        <div className="menu-section__head">
          <h2 id="combos-pizza">Pizza e refri</h2>
        </div>
        <div className="product-grid">
          {pizzas.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
      <section className="menu-section" aria-labelledby="combos-esfiha">
        <div className="menu-section__head">
          <h2 id="combos-esfiha">Esfihas</h2>
          <p className="muted">Monte a caixa com os sabores que preferir.</p>
        </div>
        <div className="product-grid">
          {esfihas.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
