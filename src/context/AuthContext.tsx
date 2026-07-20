import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import useSWR from 'swr';
import { supabase } from '../lib/supabase';
import { setSupabaseIdToken, registerUserAPI } from '../api';

export interface AccountInfo {
  subscriptionState: 'active' | 'expired' | 'unapproved';
  remainingTime: number;
  plan: string;
}

interface AuthState {
  user: any;
  accountInfo: AccountInfo | null;
  isAuthLoading: boolean;
  isSubLoading: boolean;
  signOut: () => Promise<void>;
}

const VPS_URL = 'https://2a02-4780-7-43e7--1.sslip.io';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Auth session tracking
  useEffect(() => {
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseIdToken(session.access_token);
        setUser(session.user);
      }
      setIsAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSupabaseIdToken(session.access_token);
        setUser(session.user);

        if (event === 'SIGNED_IN') {
          registerUserAPI().catch(err => console.warn('[Auth] Auto-register call failed:', err));
        }
      } else {
        setSupabaseIdToken(null);
        setUser(null);
        localStorage.removeItem('@user_approved');
      }
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Subscription check — revalidates every 5 minutes
  const { data: accountInfo, isLoading: isSubLoading } = useSWR(
    user ? 'subscription' : null,
    async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return null;

      const res = await fetch(`${VPS_URL}/api/auth/check-subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': import.meta.env.VITE_API_SECRET_KEY || 'mk-voucher-secret-2026'
        }
      });

      if (res.ok) return await res.json() as AccountInfo;
      console.warn(`[Auth] Subscription check returned status ${res.status}`);
      return null;
    },
    {
      refreshInterval: 300000,
      revalidateOnFocus: true,
      dedupingInterval: 60000,
    }
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Auth listener will clear user state automatically
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      accountInfo: accountInfo ?? null,
      isAuthLoading,
      isSubLoading: user ? isSubLoading : false,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}