import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import useSWR from 'swr';
import { supabase } from '../lib/supabase';
import { setServerUrl, setSupabaseIdToken, registerUserAPI, fetchRouterProfilesWithUserAPI } from '../api';
import type { UserData } from '../api';

export interface AccountInfo {
  subscriptionState: 'active' | 'expired' | 'unapproved';
  remainingTime: number;
  plan: string;
}

interface AuthState {
  user: any;
  userData: UserData | null;
  accountInfo: AccountInfo | null;
  isAuthLoading: boolean;
  isSubLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function deriveAccountInfo(userData: UserData | null): AccountInfo | null {
  if (!userData) return null;

  const approved = userData.approved;
  const expiresAt = userData.expiresAt;
  const quota = userData.quota;

  if (!approved) {
    return { subscriptionState: 'unapproved', remainingTime: 0, plan: quota || '' };
  }

  if (expiresAt) {
    const expiresAtDate = new Date(expiresAt);
    const now = new Date();
    const remainingMs = expiresAtDate.getTime() - now.getTime();
    const remainingTimeSec = Math.max(0, Math.floor(remainingMs / 1000));

    if (remainingTimeSec <= 0) {
      return { subscriptionState: 'expired', remainingTime: 0, plan: quota || '' };
    }

    return { subscriptionState: 'active', remainingTime: remainingTimeSec, plan: quota || '' };
  }

  // No expiry — lifetime access
  return { subscriptionState: 'active', remainingTime: 999999999, plan: quota || '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Auth session tracking
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseIdToken(session.access_token);
        setUser(session.user);
        // Initialize server URL after auth is restored
        const storedUrl = localStorage.getItem('@server_url') || '';
        setServerUrl(storedUrl);
      }
      setIsAuthLoading(false);
    });

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
      }
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch router profiles + userData. SWR deduplicates — Landing.tsx uses the same key.
  const { data, isLoading: isSubLoading } = useSWR(
    user ? 'router-profiles' : null,
    async () => {
      const result = await fetchRouterProfilesWithUserAPI();
      // console.log('[Auth] /routers/profiles response:', result);
      return result;
    },
    {
      refreshInterval: 300000,
      revalidateOnFocus: true,
      dedupingInterval: 60000,
    }
  );

  const userData = data?.userData ?? null;
  const accountInfo = deriveAccountInfo(userData);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      accountInfo,
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