import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // The Supabase auth callback is handled by the onAuthStateChange listener in App.tsx
    // Redirect to home after a brief delay
    const timer = setTimeout(() => navigate('/', { replace: true }), 500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)' }}>
      <p>Completing sign in...</p>
    </div>
  );
}