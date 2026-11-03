import { catalog, defaultIndex, flavorImage, type Image } from '@bella/domain';
import { useMemo } from 'react';

const flavorImages = () =>
  catalog.flavors
    .map(f => ({ name: f.name, image: flavorImage(defaultIndex, f.id) }))
    .filter((f): f is { name: string; image: Image } => !!f.image);

/* A house pizza photo to stand in for a built pizza with no flavor chosen yet. */
export function pickFlavorImage(seed = Math.random()): Image | null {
  const list = flavorImages();
  return list.length ? list[Math.floor(seed * list.length) % list.length]!.image : null;
}

export function useRandomFlavorImage(): Image | null {
  return useMemo(() => pickFlavorImage(), []);
}

export function imagesForFlavors(ids: string[]): Image[] {
  return ids.map(id => flavorImage(defaultIndex, id)).filter((i): i is Image => !!i);
}

const point = (deg: number, r = 75) => {
  const rad = (deg * Math.PI) / 180;
  return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)] as const;
};

/* Pie sector from the center, starting at the top and going clockwise. Points
   past the box are fine: only the part inside the image is painted. */
function sector(i: number, n: number): string {
  const from = -90 + (360 * i) / n;
  const to = -90 + (360 * (i + 1)) / n;
  const pts = ['50% 50%'];
  for (let a = from; a < to; a += 6) pts.push(point(a).map(v => `${v.toFixed(2)}%`).join(' '));
  pts.push(point(to).map(v => `${v.toFixed(2)}%`).join(' '));
  return `polygon(${pts.join(', ')})`;
}

/* One photo per chosen flavor, each in its own slice, like the pizza itself. */
export function PizzaSplitImage({ images, alt, className = '', priority = false }: { images: Image[]; alt: string; className?: string; priority?: boolean }) {
  const n = images.length;
  const signature = images.map(i => i.url).join('|');
  return (
    <span className={`product-image pizza-split is-loaded ${className}`} role="img" aria-label={alt}>
      {images.map((img, i) => (
        <img
          key={`${signature}-${i}`}
          src={img.url}
          alt=""
          width={img.width}
          height={img.height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          style={n > 1 ? { clipPath: sector(i, n) } : undefined}
        />
      ))}
      {n > 1 && (
        <svg className="pizza-split__cuts" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {images.map((_, i) => {
            const [x, y] = point(-90 + (360 * i) / n, 80);
            return <line key={i} x1="50" y1="50" x2={x} y2={y} />;
          })}
        </svg>
      )}
    </span>
  );
}
