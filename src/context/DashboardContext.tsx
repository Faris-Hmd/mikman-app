import React, { createContext, useContext } from 'react';

export interface AccountInfo {
  subscriptionState: 'active' | 'expired' | 'unapproved';
  remainingTime: number;
  plan: string;
}

const DashboardContext = createContext<AccountInfo | null>(null);

export function DashboardProvider({ children, value }: { children: React.ReactNode; value: AccountInfo }) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  return context;
}