import { Navigate, Outlet } from 'react-router';
import { ApiError } from '../../api/client';
import { useMe } from './useAuth';

export function RequireAuth() {
  const me = useMe();

  if (me.isPending) return <p>Loading…</p>;
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <Navigate to="/login" replace />;
    }
    return <p>Could not reach the API.</p>;
  }
  if (!me.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
