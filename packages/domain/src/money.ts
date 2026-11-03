const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/* Intl inserts a non breaking space after "R$"; keep it so the value never wraps. */
export function formatBRL(cents: number): string {
  return formatter.format(cents / 100);
}

export function assertCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Valor em centavos inválido: ${value}`);
  return value;
}

/* Splits a whole price into one fraction, rounding half up to the cent. */
export function fraction(cents: number, parts: number): number {
  return Math.round(assertCents(cents) / parts);
}
