import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/ui/LoadingScreen';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, accountInfo, isSubLoading } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (isSubLoading || !accountInfo) return;
    navigate('/', { replace: true });
  }, [user, accountInfo, isSubLoading, navigate]);

  return <LoadingScreen loadingTitle="Completing sign in..." />;
}
