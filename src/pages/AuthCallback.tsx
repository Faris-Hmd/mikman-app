import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, accountInfo, isSubLoading } = useAuth();

  useEffect(() => {
    // AuthContext handles the OAuth exchange and SWR fetching.
    // Just wait until everything is settled, then redirect.
    if (!user) return; // Not yet authenticated

    if (isSubLoading) return; // Still fetching account info

    if (accountInfo && accountInfo.subscriptionState === 'active') {
      navigate('/', { replace: true });
    }
    // If not active (unapproved/expired), App.tsx will show PlansPage
    // No need to do anything — the user stays here
  }, [user, accountInfo, isSubLoading, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)', gap: '16px' }}>
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--glass-border)', borderTopColor: 'var(--primary)', animation: 'spin 0.6s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Completing sign in...</p>
    </div>
  );
}