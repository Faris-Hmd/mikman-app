import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const handleAuth = async () => {
      // Listen for the actual auth state change after Supabase processes the hash fragment
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session) {
          // Session established — redirect to home
          navigate('/', { replace: true });
        } else if (event === 'USER_UPDATED' && session) {
          navigate('/', { replace: true });
        }
      });

      unsubscribe = () => subscription.unsubscribe();

      // Also check if session already exists (e.g. on re-render)
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted && session) {
        navigate('/', { replace: true });
        return;
      }

      // Fallback: if nothing happens after 5 seconds, show error
      setTimeout(() => {
        if (mounted) {
          setError('Authentication timed out. Please try signing in again.');
        }
      }, 5000);
    };

    handleAuth();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)', gap: '16px' }}>
      {error ? (
        <>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            style={{ padding: '8px 20px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            Back to Sign In
          </button>
        </>
      ) : (
        <>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--glass-border)', borderTopColor: 'var(--primary)', animation: 'spin 0.6s linear infinite' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Completing sign in...</p>
        </>
      )}
    </div>
  );
}