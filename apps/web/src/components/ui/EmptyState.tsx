import type { ReactNode } from 'react';
import { ProductArt, type ArtKind } from './ProductArt';

export function EmptyState({ title, children, action, art = 'pizza' }: { title: string; children?: ReactNode; action?: ReactNode; art?: ArtKind }) {
  return (
    <div className="empty">
      <ProductArt kind={art} />
      <h2 className="empty__title">{title}</h2>
      {children && <div className="empty__text">{children}</div>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
