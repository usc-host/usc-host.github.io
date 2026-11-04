import { createElement, lazy, type ComponentType } from 'react';
import { matchPath } from 'react-router';

type Module = { default: ComponentType };
type Loader = () => Promise<Module>;

export interface AppRoute {
  path: string;
  Component: ComponentType;
  load: Loader;
}

/* Every page is its own chunk. load() is what the transition coordinator
   waits for before swapping pages under the brand loader. Once a chunk is in,
   the page renders directly: React.lazy would call the import again and
   suspend for a tick, flashing the Suspense fallback. */
const loaded = new Set<string>();
function page(path: string, loader: Loader): AppRoute {
  let module: Module | null = null;
  let pending: Promise<Module> | null = null;
  const load: Loader = () =>
    (pending ??= loader().then(mod => {
      module = mod;
      loaded.add(path);
      return mod;
    }, error => {
      pending = null;
      throw error;
    }));
  const Lazy = lazy(load);
  const Component = () => createElement(module?.default ?? Lazy);
  return { path, Component, load };
}

export const routes: AppRoute[] = [
  page('/', () => import('../pages/HomePage')),
  page('/cardapio', () => import('../pages/MenuPage')),
  page('/produto/:slug', () => import('../pages/ProductPage')),
  page('/combos', () => import('../pages/CombosPage')),
  page('/carrinho', () => import('../pages/CartPage')),
  page('/revisao', () => import('../pages/ReviewPage')),
  page('/sobre', () => import('../pages/AboutPage')),
  page('/fidelidade', () => import('../pages/LoyaltyPage')),
  page('/conta', () => import('../pages/AccountPage')),
  page('*', () => import('../pages/NotFoundPage'))
];

export function matchRoute(pathname: string): AppRoute {
  return routes.find(r => r.path !== '*' && matchPath(r.path, pathname)) ?? routes[routes.length - 1]!;
}

export const isLoaded = (route: AppRoute) => loaded.has(route.path);
