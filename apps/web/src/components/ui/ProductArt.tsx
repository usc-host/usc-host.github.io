/* Drawn artwork for items without an approved photo. It represents the kind of
   product, never a specific recipe, so no dish is shown as something it is not. */
export type ArtKind = 'pizza' | 'sweet' | 'esfiha' | 'drink' | 'combo';

export function artKindFor(categoryIds: string[]): ArtKind {
  if (categoryIds.includes('bebidas')) return 'drink';
  if (categoryIds.includes('combos')) return 'combo';
  if (categoryIds.includes('esfihas')) return 'esfiha';
  if (categoryIds.includes('doces')) return 'sweet';
  return 'pizza';
}

function Pizza({ sweet = false }: { sweet?: boolean }) {
  return (
    <g>
      <circle cx="100" cy="100" r="62" fill="var(--art-crust)" />
      <circle cx="100" cy="100" r="52" fill={sweet ? '#7a4a2c' : 'var(--art-sauce)'} />
      <circle cx="100" cy="100" r="47" fill={sweet ? '#9a6236' : 'var(--art-cheese)'} opacity="0.95" />
      {[0, 60, 120, 180, 240, 300].map(a => (
        <line key={a} x1="100" y1="100" x2={100 + 52 * Math.cos((a * Math.PI) / 180)} y2={100 + 52 * Math.sin((a * Math.PI) / 180)} stroke="var(--art-crust)" strokeWidth="2.5" opacity="0.7" />
      ))}
      {(sweet ? [[82, 84], [118, 90], [96, 120], [124, 118], [74, 112]] : [[84, 82], [118, 86], [98, 118], [126, 116], [72, 110], [104, 96]]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={sweet ? 4 : 6} fill={sweet ? '#f6e3c6' : i % 2 ? 'var(--art-leaf)' : 'var(--art-sauce)'} />
      ))}
    </g>
  );
}

function Esfiha() {
  return (
    <g>
      <path d="M100 44 C 138 44 158 78 156 112 C 154 146 128 160 100 160 C 72 160 46 146 44 112 C 42 78 62 44 100 44 Z" fill="var(--art-crust)" />
      <path d="M100 60 C 128 60 142 84 140 110 C 138 136 120 146 100 146 C 80 146 62 136 60 110 C 58 84 72 60 100 60 Z" fill="var(--art-sauce)" opacity="0.85" />
      {[[88, 96], [112, 100], [98, 120], [118, 124], [80, 118]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill={i % 2 ? 'var(--art-leaf)' : 'var(--art-cheese)'} />
      ))}
    </g>
  );
}

function Drink() {
  return (
    <g>
      <rect x="76" y="58" width="48" height="96" rx="12" fill="var(--art-sauce)" />
      <rect x="84" y="44" width="32" height="18" rx="6" fill="var(--art-crust)" />
      <rect x="76" y="92" width="48" height="26" fill="var(--art-cheese)" />
      <circle cx="100" cy="105" r="7" fill="var(--art-sauce)" />
    </g>
  );
}

function Combo() {
  return (
    <g transform="translate(-14 4) scale(0.86)">
      <Pizza />
      <g transform="translate(96 74) scale(0.42)">
        <Drink />
      </g>
    </g>
  );
}

export function ProductArt({ kind, label }: { kind: ArtKind; label?: string }) {
  return (
    <span className={`product-art product-art--${kind}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 200 200" focusable="false">
        <circle cx="100" cy="100" r="86" fill="currentColor" opacity="0.08" />
        {kind === 'pizza' && <Pizza />}
        {kind === 'sweet' && <Pizza sweet />}
        {kind === 'esfiha' && <Esfiha />}
        {kind === 'drink' && <Drink />}
        {kind === 'combo' && <Combo />}
      </svg>
    </span>
  );
}
