import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: 'md' | 'sm';
}

/* Buttons step the quantity; the number in the middle can also be typed.
   A valid number applies right away, anything else is fixed on blur. */
export function QuantityStepper({ value, onChange, min = 1, max = 99, label, size = 'md' }: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.trunc(n)));

  function type(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, String(max).length);
    setDraft(digits);
    const n = Number(digits);
    if (digits && n >= min && n <= max && n !== value) onChange(n);
  }

  function settle() {
    const n = clamp(Number(draft) || min);
    setDraft(String(n));
    if (n !== value) onChange(n);
  }

  return (
    <div className={`stepper stepper--${size}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Diminuir ${label.toLowerCase()}`}>
        <MinusOutlined />
      </button>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        max={max}
        value={draft}
        aria-label={label}
        onChange={e => type(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={settle}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          // Letters and signs a number field would otherwise accept.
          if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
        }}
      />
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Aumentar ${label.toLowerCase()}`}>
        <PlusOutlined />
      </button>
    </div>
  );
}
