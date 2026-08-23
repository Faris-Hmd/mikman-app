import { createContext, useContext } from 'react';
import type { UserData } from '../api';

export interface AccountInfo {
  subscriptionState: 'active' | 'expired' | 'banned' | 'unapproved';
  remainingTime: number;
  plan: string;
}

export interface AuthState {
  user: any;
  userData: UserData | null;
  accountInfo: AccountInfo | null;
  isAuthLoading: boolean;
  isSubLoading: boolean;
  signOut: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export { AuthProvider } from './AuthProvider';

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}