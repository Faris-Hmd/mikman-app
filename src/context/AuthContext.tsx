import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import useSWR from 'swr';
import { supabase } from '../lib/supabase';
import { setServerUrl, setSupabaseIdToken, registerUserAPI, fetchRouterProfilesWithUserAPI } from '../api';
import type { UserData } from '../api';

export interface AccountInfo {
  subscriptionState: 'active' | 'expired' | 'banned' | 'unapproved';
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
  checkStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function deriveAccountInfo(userData: UserData | null): AccountInfo | null {
  if (!userData) return null;

  const approved = userData.approved;
  const expiresAt = userData.expiresAt;
  const quota = userData.quota;

  // Explicitly banned by admin
  if (approved === false) {
    return { subscriptionState: 'banned', remainingTime: 0, plan: quota || '' };
  }

  // Approved — check if plan access period has expired
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

  // No expiry — lifetime active
  return { subscriptionState: 'active', remainingTime: 999999999, plan: quota || '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [cachedUserData, setCachedUserData] = useState<UserData | null>(() => {
    try {
      const saved = localStorage.getItem('@cached_user_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auth session tracking
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseIdToken(session.access_token);
        setUser(session.user);
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
          try {
            await registerUserAPI();
          } catch (err) {
            console.warn('[Auth] Auto-register call failed:', err);
          }
          await checkStatus();
        }
      } else {
        setSupabaseIdToken(null);
        setUser(null);
        setCachedUserData(null);
        try { localStorage.removeItem('@cached_user_data'); } catch {}
      }
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Window event listeners for 403 Banned / Expired responses
  useEffect(() => {
    const handleBanned = () => {
      setCachedUserData(prev => {
        if (prev && prev.approved === false) return prev;
        const bannedUserData: UserData = {
          email: user?.email || '',
          approved: false,
          expiresAt: null,
          maxRouters: 0,
          quota: 'free',
          hasPassword: true,
          name: null,
        };
        try { localStorage.setItem('@cached_user_data', JSON.stringify(bannedUserData)); } catch {}
        return bannedUserData;
      });
    };

    const handleExpired = () => {
      setCachedUserData(prev => {
        if (prev && prev.quota === 'expired') return prev;
        const expiredUserData: UserData = {
          email: user?.email || '',
          approved: true,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
          maxRouters: 0,
          quota: 'expired',
          hasPassword: true,
          name: null,
        };
        try { localStorage.setItem('@cached_user_data', JSON.stringify(expiredUserData)); } catch {}
        return expiredUserData;
      });
    };

    window.addEventListener('account:banned', handleBanned);
    window.addEventListener('account:expired', handleExpired);

    return () => {
      window.removeEventListener('account:banned', handleBanned);
      window.removeEventListener('account:expired', handleExpired);
    };
  }, [user]);

  // SWR continuously polls every 15s or on window focus
  const { data, isLoading: isSubLoading, mutate } = useSWR(
    user ? 'router-profiles' : null,
    async () => {
      const result = await fetchRouterProfilesWithUserAPI();
      return result;
    },
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    if (data?.userData) {
      setCachedUserData(prev => {
        if (prev && JSON.stringify(prev) === JSON.stringify(data.userData)) return prev;
        try {
          localStorage.setItem('@cached_user_data', JSON.stringify(data.userData));
        } catch (e) {
          console.warn('Failed to cache user data:', e);
        }
        return data.userData;
      });
    }
  }, [data]);

  const activeUserData = data?.userData || cachedUserData;
  const accountInfo = deriveAccountInfo(activeUserData);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetchRouterProfilesWithUserAPI();
      if (res?.userData) {
        setCachedUserData(res.userData);
        try {
          localStorage.setItem('@cached_user_data', JSON.stringify(res.userData));
        } catch {}
      }
      await mutate();
    } catch (e) {
      console.warn('[Auth] Check status error:', e);
    }
  }, [mutate]);

  const signOut = useCallback(async () => {
    try { localStorage.removeItem('@cached_user_data'); } catch {}
    setCachedUserData(null);
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      userData: activeUserData,
      accountInfo,
      isAuthLoading,
      isSubLoading: user ? (isSubLoading || !activeUserData) : false,
      signOut,
      checkStatus,
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