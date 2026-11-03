import { catalog } from '@bella/domain';
import { useState } from 'react';

/* The full logo file with its own background, on a cream plate so it reads
   the same in both themes. Falls back to a wordmark if the image fails. */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const { logo } = catalog.store;
  return (
    <span className={`logo-plate logo-plate--${size}${failed ? ' is-fallback' : ''}`}>
      {failed ? (
        <span className="logo-plate__wordmark">Bella Massa</span>
      ) : (
        <img src={logo.url} width={logo.width} height={logo.height} alt={logo.alt} onError={() => setFailed(true)} />
      )}
    </span>
  );
}
