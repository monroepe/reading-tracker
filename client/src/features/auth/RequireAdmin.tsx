import { Navigate, Outlet } from 'react-router';
import { useMe } from './useAuth';

export function RequireAdmin() {
  const me = useMe();
  if (me.isPending) return <p className="p-6">Loading…</p>;
  return me.data?.role === 'admin' ? <Outlet /> : <Navigate to="/books" replace />;
}
