import React, { createContext, useContext } from 'react';
import { RouterProvisionStatus } from '../api';

export interface RouterContextValue {
  routerId: string;
  status: RouterProvisionStatus | null;
  isConnected: boolean;
  isLoading: boolean;
  mutate: () => Promise<any>;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children, value }: { children: React.ReactNode; value: RouterContextValue }) {
  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouterContext() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouterContext must be used within a RouterProvider');
  }
  return context;
}