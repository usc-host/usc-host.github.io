import { useLayoutEffect, useRef, useState } from 'react';

interface Item {
  id: string;
  label: string;
  count?: number;
}

/* Horizontal category tabs with an indicator that slides to the active one,
   adapted from the LojaBetero sliding menu. The active tab is kept in view. */
export function CategoryRail({ items, active, onSelect, label }: { items: Item[]; active: string; onSelect: (id: string) => void; label: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });

  useLayoutEffect(() => {
    const measure = () => {
      const el = rail.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
      if (!el) return;
      setIndicator(prev => ({ x: el.offsetLeft, w: el.offsetWidth, ready: prev.ready || prev.w > 0 }));
      // Scroll only the rail itself, never the page.
      const box = rail.current!;
      if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) {
        box.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (rail.current) observer.observe(rail.current);
    return () => observer.disconnect();
  }, [active, items.length]);

  return (
    <div className="rail" ref={rail} role="tablist" aria-label={label}>
      <span
        className={`rail__indicator${indicator.ready ? '' : ' is-instant'}`}
        aria-hidden="true"
        style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }}
      />
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          role="tab"
          data-id={item.id}
          aria-selected={item.id === active}
          className={`rail__tab${item.id === active ? ' is-active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className="rail__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
