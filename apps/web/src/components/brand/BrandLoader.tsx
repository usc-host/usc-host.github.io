import { catalog } from '@bella/domain';
import { Button } from 'antd';
import { useState } from 'react';
import { useDots } from '../../lib/hooks';

interface BrandLoaderProps {
  /* overlay covers the page during route changes, inline sits inside content,
     compact is the small version for local states. */
  variant?: 'overlay' | 'inline' | 'compact';
  brief?: boolean;
  leaving?: boolean;
  label?: string;
  error?: { message: string; onRetry: () => void; onBack?: () => void } | null;
}

/* Shares the classes defined in index.html with the boot screen, so the first
   load and every page change look exactly the same. */
export function BrandLoader({ variant = 'overlay', brief = false, leaving = false, label = 'Carregando', error = null }: BrandLoaderProps) {
  const dots = useDots(!error);
  const [failed, setFailed] = useState(false);
  const { logo } = catalog.store;
  const classes = [
    'bm-loader',
    variant !== 'overlay' && 'bm-loader--inline',
    variant === 'compact' && 'bm-loader--compact',
    brief && 'bm-loader--brief',
    leaving && 'is-leaving',
    error && 'has-error'
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status">
      <span className="bm-sr-only">{error ? '' : `${label} página`}</span>
      <div className={`bm-loader__plate${failed ? ' is-fallback' : ''}`}>
        <img className="bm-loader__logo" src={logo.url} alt="" width={logo.width} height={logo.height} onError={() => setFailed(true)} />
        <span className="bm-loader__wordmark" aria-hidden="true">Bella Massa</span>
      </div>
      <span className="bm-loader__label" aria-hidden="true">
        {label}
        <span className="bm-dots">{dots}</span>
      </span>
      {error && (
        <div className="bm-loader__error" role="alert">
          <p>{error.message}</p>
          <div className="bm-loader__actions">
            <Button type="primary" size="large" shape="round" onClick={error.onRetry}>Tentar novamente</Button>
            {error.onBack && <Button size="large" shape="round" onClick={error.onBack}>Voltar</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* Small inline status used inside the chat and the cart. */
export function BrandStatus({ label }: { label: string }) {
  const dots = useDots();
  return (
    <span className="brand-status" role="status">
      <span className="brand-status__mark" aria-hidden="true" />
      <span>
        {label}
        <span className="bm-dots" aria-hidden="true">{dots}</span>
      </span>
    </span>
  );
}
