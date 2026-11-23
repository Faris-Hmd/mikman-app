import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../components/layout/shell.css';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, accountInfo, isSubLoading } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (isSubLoading || !accountInfo) return;
    navigate('/', { replace: true });
  }, [user, accountInfo, isSubLoading, navigate]);

  return (
    <div className="shell-loading-center">
      <div className="spinner" />
      <p className="text-muted text-sm m-0">Completing sign in...</p>
    </div>
  );
}
