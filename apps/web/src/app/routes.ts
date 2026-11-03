import { lazy, type ComponentType } from 'react';
import { matchPath } from 'react-router';

type Loader = () => Promise<{ default: ComponentType }>;

export interface AppRoute {
  path: string;
  Component: ComponentType;
  load: Loader;
}

/* Every page is its own chunk. load() is what the transition coordinator
   waits for before swapping pages under the brand loader. */
const loaded = new Set<string>();
function page(path: string, loader: Loader): AppRoute {
  const load: Loader = () => loader().then(mod => {
    loaded.add(path);
    return mod;
  });
  return { path, Component: lazy(load), load };
}

export const routes: AppRoute[] = [
  page('/', () => import('../pages/HomePage')),
  page('/cardapio', () => import('../pages/MenuPage')),
  page('/produto/:slug', () => import('../pages/ProductPage')),
  page('/combos', () => import('../pages/CombosPage')),
  page('/carrinho', () => import('../pages/CartPage')),
  page('/revisao', () => import('../pages/ReviewPage')),
  page('/sobre', () => import('../pages/AboutPage')),
  page('*', () => import('../pages/NotFoundPage'))
];

export function matchRoute(pathname: string): AppRoute {
  return routes.find(r => r.path !== '*' && matchPath(r.path, pathname)) ?? routes[routes.length - 1]!;
}

export const isLoaded = (route: AppRoute) => loaded.has(route.path);
