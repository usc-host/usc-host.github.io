import { useCallback, useEffect, useState } from 'react';
import { local, readJson, writeJson } from '../../lib/storage';

/* Delivery addresses and contact details are kept on this device only, so a
   returning customer reviews instead of retyping. Payment is never stored. */

export const CITIES = ['Barra Bonita', 'Igaraçu do Tietê'] as const;

export interface Address {
  id: string;
  label: string;
  street: string;
  number: string;
  district: string;
  city: string;
  complement?: string;
  reference?: string;
}

export interface Contact {
  name: string;
  phone: string;
}

interface Book {
  v: 1;
  addresses: Address[];
  selectedId: string | null;
  contact: Contact | null;
}

const KEY = 'bm-checkout';
const EMPTY: Book = { v: 1, addresses: [], selectedId: null, contact: null };

function load(): Book {
  const saved = readJson<Partial<Book>>(local, KEY);
  if (!saved || saved.v !== 1 || !Array.isArray(saved.addresses)) return EMPTY;
  const addresses = saved.addresses.filter((a): a is Address => !!a && typeof a.id === 'string' && typeof a.street === 'string');
  return {
    v: 1,
    addresses,
    selectedId: addresses.some(a => a.id === saved.selectedId) ? saved.selectedId! : addresses[0]?.id ?? null,
    contact: saved.contact && typeof saved.contact.name === 'string' ? saved.contact : null
  };
}

export function formatAddress(a: Address): string {
  return [`${a.street}, ${a.number}`, a.complement, a.district, a.city].filter(Boolean).join(', ');
}

export function useCheckoutBook() {
  const [book, setBook] = useState<Book>(load);

  useEffect(() => {
    writeJson(local, KEY, book);
  }, [book]);

  const saveAddress = useCallback((address: Omit<Address, 'id'> & { id?: string }) => {
    const id = address.id ?? (crypto.randomUUID?.() ?? `${Date.now()}`);
    setBook(b => {
      const exists = b.addresses.some(a => a.id === id);
      const next = { ...address, id } as Address;
      return { ...b, addresses: exists ? b.addresses.map(a => (a.id === id ? next : a)) : [...b.addresses, next], selectedId: id };
    });
    return id;
  }, []);

  const removeAddress = useCallback((id: string) => {
    setBook(b => {
      const addresses = b.addresses.filter(a => a.id !== id);
      return { ...b, addresses, selectedId: b.selectedId === id ? addresses[0]?.id ?? null : b.selectedId };
    });
  }, []);

  const selectAddress = useCallback((id: string) => setBook(b => ({ ...b, selectedId: id })), []);
  const saveContact = useCallback((contact: Contact) => setBook(b => ({ ...b, contact })), []);

  return {
    addresses: book.addresses,
    selected: book.addresses.find(a => a.id === book.selectedId) ?? null,
    contact: book.contact,
    saveAddress,
    removeAddress,
    selectAddress,
    saveContact
  };
}
