import { MinusOutlined, PlusOutlined } from '@ant-design/icons';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: 'md' | 'sm';
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, label, size = 'md' }: Props) {
  return (
    <div className={`stepper stepper--${size}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Diminuir ${label.toLowerCase()}`}>
        <MinusOutlined />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Aumentar ${label.toLowerCase()}`}>
        <PlusOutlined />
      </button>
    </div>
  );
}
