import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate, useNavigationType, type Location } from 'react-router';
import { BrandLoader } from '../components/brand/BrandLoader';
import { isLoaded, matchRoute, routes } from './routes';

const BRIEF_MS = 480;
const FULL_MS = 860;
const LEAVE_MS = 240;
const TIMEOUT_MS = 12000;

type Phase = 'idle' | 'loading' | 'leaving' | 'error';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/* Coordinates every real page change, including back and forward: the brand
   loader covers the swap, fast routes get the brief version, slow ones wait
   for their chunk or fail with a recoverable error. Changes that stay on the
   same page (search, filters, query string) never trigger it. */
export function RouteStage() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const [shown, setShown] = useState<Location>(location);
  const [phase, setPhase] = useState<Phase>('idle');
  const [brief, setBrief] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const token = useRef(0);
  const scrolls = useRef(new Map<string, number>());
  const firstPaint = useRef(true);

  useEffect(() => {
    if (location.key === shown.key && attempt === 0) return;
    if (location.pathname === shown.pathname) {
      setShown(location);
      return;
    }
    const id = ++token.current;
    const route = matchRoute(location.pathname);
    const quick = isLoaded(route);
    const started = performance.now();
    setBrief(quick);
    setPhase('loading');

    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));
    Promise.race([route.load(), timeout])
      .then(async () => {
        if (id !== token.current) return;
        await wait(Math.max(0, (quick ? BRIEF_MS : FULL_MS) - (performance.now() - started)));
        if (id !== token.current) return;
        scrolls.current.set(shown.key, window.scrollY);
        setShown(location);
        setAttempt(0);
        setPhase('leaving');
        await wait(LEAVE_MS);
        if (id === token.current) setPhase('idle');
      })
      .catch(() => {
        if (id === token.current) setPhase('error');
      });
    // shown is read for the scroll position only; including it would restart the cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, attempt]);

  useEffect(() => () => {
    token.current++;
  }, []);

  // New page: restore the old position on back/forward, otherwise start at the
  // top, and move focus to the main region for keyboard and screen reader users.
  useLayoutEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    const saved = scrolls.current.get(shown.key);
    window.scrollTo({ top: navType === 'POP' && saved !== undefined ? saved : 0, behavior: 'instant' });
    document.getElementById('main')?.focus({ preventScroll: true });
    // only when the displayed page changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.pathname]);

  // The boot screen from index.html leaves once the first page is on screen.
  useEffect(() => {
    window.__bellaBoot?.done();
  }, []);

  function retry() {
    if (attempt >= 2) {
      window.location.assign(location.pathname + location.search);
      return;
    }
    setAttempt(a => a + 1);
  }

  function back() {
    token.current++;
    setPhase('idle');
    setAttempt(0);
    navigate(shown.pathname + shown.search, { replace: true });
  }

  return (
    <>
      <Suspense fallback={<BrandLoader brief />}>
        <Routes location={shown}>
          {routes.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component key={shown.pathname} />} />
          ))}
        </Routes>
      </Suspense>
      {phase !== 'idle' && (
        <BrandLoader
          brief={brief}
          leaving={phase === 'leaving'}
          error={phase === 'error' ? { message: 'Não foi possível abrir esta página agora.', onRetry: retry, onBack: back } : null}
        />
      )}
    </>
  );
}

declare global {
  interface Window {
    __bellaBoot?: { done(): void; fail(): void };
  }
}
