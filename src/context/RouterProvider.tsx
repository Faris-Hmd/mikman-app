import React from 'react';
import { RouterContext, RouterContextValue } from './RouterContext';

export function RouterProvider({ children, value }: { children: React.ReactNode; value: RouterContextValue }) {
  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
}
