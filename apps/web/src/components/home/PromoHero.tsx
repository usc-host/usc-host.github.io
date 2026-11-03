import { catalog, defaultIndex, formatBRL, fromPriceCents, productDescription, type Promotion } from '@bella/domain';
import { ArrowRightOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { asset } from '../../lib/asset';
import { useReducedMotion } from '../../lib/hooks';

const SLIDE_MS = 7000;

interface Slide {
  promo: Promotion;
  eyebrow: string;
  title: string;
  text: string;
  price: string;
  cta: string;
  href: string;
}

/* Copy for each highlight comes from the catalog: name, recipe and price. */
function slides(): Slide[] {
  return catalog.promotions.flatMap(promo => {
    const product = defaultIndex.product(promo.productId);
    if (!product) return [];
    const from = fromPriceCents(defaultIndex, product);
    const fixed = product.variants.length === 1;
    const isNew = product.badge === 'Novidade';
    return [{
      promo,
      eyebrow: isNew ? 'Novidade no cardápio' : product.kind === 'combo' ? 'Combo completo' : promo.title,
      title: product.name,
      text: isNew
        ? `${productDescription(product)} Grande ou broto.`
        : productDescription(product),
      price: from === null ? '' : `${fixed ? '' : 'a partir de '}${formatBRL(from)}`,
      cta: product.kind === 'combo' ? 'Montar meu combo' : 'Pedir agora',
      href: `/produto/${product.slug}`
    }];
  });
}

const SLIDES = slides();

export function PromoHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const count = SLIDES.length;
  const go = useCallback((n: number) => setActive(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || reduced || count < 2) return;
    const t = setTimeout(() => go(active + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused, reduced, count, go]);

  const slide = SLIDES[active];
  if (!slide) return null;

  return (
    <section
      className="promo"
      aria-roledescription="carrossel"
      aria-label="Destaques da Bella Massa"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <h1 className="sr-only">Bella Massa, pizzas e esfihas em Barra Bonita</h1>
      <div className="container promo__grid">
        <div className="promo__stage">
          {SLIDES.map((s, i) => (
            <button
              key={s.promo.id}
              type="button"
              className={`promo__slide${i === active ? ' is-active' : ''}`}
              onClick={() => navigate(s.href)}
              aria-hidden={i !== active}
              tabIndex={i === active ? 0 : -1}
              aria-label={`${s.eyebrow}: ${s.title}`}
            >
              <img
                src={asset(s.promo.image.url)}
                alt={s.promo.image.alt}
                width={s.promo.image.width}
                height={s.promo.image.height}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>

        <div className="promo__card">
          <div className="promo__top">
            <span key={`${slide.promo.id}-eyebrow`} className="promo__eyebrow">{slide.eyebrow}</span>
            {count > 1 && (
              <div className="promo__controls">
                <div className="promo__dots" role="tablist" aria-label="Escolher destaque">
                  {SLIDES.map((s, i) => (
                    <button
                      key={s.promo.id}
                      type="button"
                      role="tab"
                      aria-selected={i === active}
                      aria-label={s.eyebrow}
                      className={`promo__dot${i === active ? ' is-active' : ''}${paused || reduced ? ' is-paused' : ''}`}
                      style={{ '--slide-ms': `${SLIDE_MS}ms` } as React.CSSProperties}
                      onClick={() => go(i)}
                    >
                      <span />
                    </button>
                  ))}
                </div>
                <div className="promo__arrows">
                  <button type="button" onClick={() => go(active - 1)} aria-label="Destaque anterior"><LeftOutlined /></button>
                  <button type="button" onClick={() => go(active + 1)} aria-label="Próximo destaque"><RightOutlined /></button>
                </div>
              </div>
            )}
          </div>
          <div key={slide.promo.id} className="promo__copy" aria-live="polite">
            <h2 className="promo__title">{slide.title}</h2>
            <p className="promo__text">{slide.text}</p>
            {slide.price && <p className="promo__price price">{slide.price}</p>}
          </div>
          <div className="promo__actions">
            <Button type="primary" size="large" shape="round" onClick={() => navigate(slide.href)}>
              {slide.cta} <ArrowRightOutlined />
            </Button>
            <Button size="large" shape="round" onClick={() => navigate('/cardapio')}>Ver cardápio</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
