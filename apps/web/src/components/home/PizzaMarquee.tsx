import { catalog, defaultIndex, formatBRL, fromPriceCents, primaryImage, type Product } from '@bella/domain';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { asset } from '../../lib/asset';
import { readOrderStats } from '../../lib/stats';

const SPEED = 38; // px per second
const DRAG_THRESHOLD = 6;

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function Tile({ product, hidden }: { product: Product; hidden?: boolean }) {
  const image = primaryImage(product);
  const from = fromPriceCents(defaultIndex, product);
  return (
    <Link
      to={`/produto/${product.slug}`}
      className="marquee-tile"
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden}
      draggable={false}
      title={product.name}
    >
      {image && <img src={asset(image.url)} alt={hidden ? '' : image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" draggable={false} />}
      {product.badge && <span className="marquee-tile__badge">{product.badge}</span>}
      <span className="marquee-tile__info">
        <strong>{product.name}</strong>
        {from !== null && <span className="price">a partir de {formatBRL(from)}</span>}
      </span>
    </Link>
  );
}

/* Moves the track with requestAnimationFrame so it can loop forever, pause on
   hover or focus, and follow a drag with a little momentum. A drag never
   counts as a click on the tile underneath. */
function useMarquee(viewport: React.RefObject<HTMLDivElement | null>, track: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const vp = viewport.current;
    const el = track.current;
    if (!vp || !el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let offset = 0;
    let velocity = 0;
    let previous = performance.now();
    let hovering = false;
    let focused = false;
    let pointer: { id: number; startX: number; startOffset: number; lastX: number; lastT: number; dragging: boolean } | null = null;
    let suppressClick = false;
    let raf = 0;

    const period = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      return (el.scrollWidth + gap) / 2;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!pointer?.dragging) {
        if (Math.abs(velocity) > 5) {
          offset += velocity * dt;
          velocity *= Math.pow(0.04, dt);
        } else if (!hovering && !focused && !reduced) {
          offset -= SPEED * dt;
        }
      }
      const p = period();
      if (p > 0) offset = ((offset % p) - p) % p;
      el.style.transform = `translate3d(${offset}px, 0, 0)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      velocity = 0;
      pointer = { id: e.pointerId, startX: e.clientX, startOffset: offset, lastX: e.clientX, lastT: performance.now(), dragging: false };
    };
    const move = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dx = e.clientX - pointer.startX;
      if (!pointer.dragging && Math.abs(dx) > DRAG_THRESHOLD) {
        pointer.dragging = true;
        // Capture only once it is a drag, so a plain tap still opens the tile.
        vp.setPointerCapture(e.pointerId);
        vp.classList.add('is-dragging');
      }
      if (!pointer.dragging) return;
      const now = performance.now();
      velocity = ((e.clientX - pointer.lastX) / Math.max(1, now - pointer.lastT)) * 1000;
      pointer.lastX = e.clientX;
      pointer.lastT = now;
      offset = pointer.startOffset + dx;
    };
    const up = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      if (pointer.dragging) {
        suppressClick = true;
        vp.classList.remove('is-dragging');
        if (performance.now() - pointer.lastT > 80) velocity = 0;
      }
      pointer = null;
    };
    const click = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovering = true;
    };
    const leave = () => {
      hovering = false;
    };
    const focusIn = () => {
      focused = true;
    };
    const focusOut = () => {
      focused = false;
    };

    vp.addEventListener('pointerdown', down);
    vp.addEventListener('pointermove', move);
    vp.addEventListener('pointerup', up);
    vp.addEventListener('pointercancel', up);
    vp.addEventListener('click', click, true);
    vp.addEventListener('pointerenter', enter);
    vp.addEventListener('pointerleave', leave);
    vp.addEventListener('focusin', focusIn);
    vp.addEventListener('focusout', focusOut);
    return () => {
      cancelAnimationFrame(raf);
      vp.removeEventListener('pointerdown', down);
      vp.removeEventListener('pointermove', move);
      vp.removeEventListener('pointerup', up);
      vp.removeEventListener('pointercancel', up);
      vp.removeEventListener('click', click, true);
      vp.removeEventListener('pointerenter', enter);
      vp.removeEventListener('pointerleave', leave);
      vp.removeEventListener('focusin', focusIn);
      vp.removeEventListener('focusout', focusOut);
    };
  }, [viewport, track]);
}

/* Pizzas ranked by what was ordered on this device; with no orders yet the
   order is shuffled on each visit. The list is rendered twice so the strip
   loops without a seam; the copy is hidden from assistive tech. */
export function PizzaMarquee() {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useMarquee(viewport, track);

  const { pizzas, ranked } = useMemo(() => {
    const all = catalog.products.filter(p => p.kind === 'pizza' && primaryImage(p));
    const stats = readOrderStats();
    const hasStats = all.some(p => stats[p.id]);
    return {
      ranked: hasStats,
      pizzas: hasStats ? [...all].sort((a, b) => (stats[b.id] ?? 0) - (stats[a.id] ?? 0)) : shuffle(all)
    };
  }, []);

  return (
    <section className="section marquee-section" aria-labelledby="marquee-title">
      <div className="container section__head">
        <div>
          <span className="eyebrow">{ranked ? 'Os favoritos' : 'Da nossa cozinha'}</span>
          <h2 id="marquee-title">{ranked ? 'Mais pedidas' : 'Sabores da casa'}</h2>
        </div>
        <Link to="/cardapio?categoria=premium" className="text-link">Ver todas <ArrowRightOutlined /></Link>
      </div>
      <div className="marquee" ref={viewport}>
        <div className="marquee__track" ref={track}>
          {pizzas.map(p => <Tile key={p.id} product={p} />)}
          {pizzas.map(p => <Tile key={`${p.id}-copy`} product={p} hidden />)}
        </div>
      </div>
    </section>
  );
}
