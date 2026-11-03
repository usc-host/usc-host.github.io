import type { Image } from '@bella/domain';
import { useState } from 'react';
import { ProductArt, type ArtKind } from './ProductArt';

interface Props {
  image: Image | null | undefined;
  art: ArtKind;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

/* Reserves the box before loading, fades the photo in and falls back to the
   drawn artwork when there is no photo or it fails to load. */
export function ProductImage({ image, art, priority = false, className = '' }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className={`product-image ${className}${loaded ? ' is-loaded' : ''}`}>
      {image && !failed ? (
        <img
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <ProductArt kind={art} />
      )}
    </span>
  );
}
