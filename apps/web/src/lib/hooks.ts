import { useEffect, useRef, useState } from 'react';

export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} | Bella Massa` : 'Bella Massa | Pizzas e esfihas artesanais';
  }, [title]);
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useIsMobile = () => useMediaQuery('(max-width: 860px)');

/* Adds "is-visible" once the element enters the viewport. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        el.classList.add('is-visible');
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* The "." ".." "..." cycle with a fixed 450 ms step. */
export function useDots(active = true) {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setN(v => (v % 3) + 1), 450);
    return () => clearInterval(t);
  }, [active]);
  return '...'.slice(0, n);
}
