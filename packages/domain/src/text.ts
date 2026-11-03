/* Lowercase without accents, for search that ignores case and diacritics. */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/* The brand voice never uses long dashes. Model output goes through this before
   reaching the customer, the same way the UNI integration cleans its answers. */
const dashes = String.fromCharCode(0x2012, 0x2013, 0x2014, 0x2015, 0x2212);
const spacedDash = new RegExp(String.raw`\s+[${dashes}]\s+`, 'g');
const anyDash = new RegExp(`[${dashes}]`, 'g');

export function cleanDashes(value: string): string {
  return value.replace(spacedDash, ', ').replace(anyDash, '-');
}
