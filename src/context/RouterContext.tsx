import { createContext, useContext } from 'react';
import { RouterProvisionStatus } from '../api';

export interface RouterContextValue {
  routerId: string;
  status: RouterProvisionStatus | null;
  isConnected: boolean;
  isLoading: boolean;
  mutate: () => Promise<any>;
}

export const RouterContext = createContext<RouterContextValue | null>(null);

export { RouterProvider } from './RouterProvider';

export function useRouterContext() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouterContext must be used within a RouterProvider');
  }
  return context;
}