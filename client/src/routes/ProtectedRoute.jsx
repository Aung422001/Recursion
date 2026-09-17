import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/States';

/**
 * Waits for the silent refresh to finish before deciding. Without that wait,
 * every reload of a protected page would flash the login screen.
 */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** The mirror image: keeps a logged-in user off the login and signup pages. */
export function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking your session" />;
  if (user) return <Navigate to="/" replace />;
  return children;
}
