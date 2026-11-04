/* Address lookup by CEP through the public ViaCEP service. */

export interface CepAddress {
  street: string;
  district: string;
  city: string;
  uf: string;
}

export const cepDigits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

export function formatCep(value: string) {
  const d = cepDigits(value);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/* Resolves null when the CEP does not exist; network failures reject. */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`ViaCEP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (data.erro === true || data.erro === 'true') return null;
  return {
    street: text(data.logradouro, 100),
    district: text(data.bairro, 60),
    city: text(data.localidade, 60),
    uf: text(data.uf, 2)
  };
}
