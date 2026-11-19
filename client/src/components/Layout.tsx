import { TransferFlow } from '@/features/transfers/TransferFlow';
import { PageBoundary } from './PageBoundary';
import { MobilePageNavigation } from '@/components/MobilePageNavigation';
import { AppHeader } from './AppHeader';
import { MenuIcon } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useLogout, useMe } from '../features/auth/useAuth';

export function Layout() {
  const location = useLocation();
  const me = useMe();
  const logout = useLogout();

  return (
    <>
      <AppHeader actions={
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Open menu">
            <MenuIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{me.data?.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link to="/transfers" />}>Transfers</DropdownMenuItem>
            {me.data?.role === 'admin' && (
              <DropdownMenuItem render={<Link to="/admin" />}>Admin</DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      } />
      <MobilePageNavigation /><main>
        <TransferFlow key={location.pathname.startsWith('/transfers') ? 'transfers' : location.pathname}><PageBoundary><Outlet /></PageBoundary></TransferFlow>
      </main>
    </>
  );
}