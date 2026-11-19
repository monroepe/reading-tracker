import { useFormReturn } from '@/hooks/useFormReturn';
import { useContext } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useCompanion } from '@/data/capabilities';
import { clearFormDraft } from '@/hooks/useFormDraftState';
import { safeReturnTo } from '@/lib/navigation';
import { isFormPage, ScrollReturnContext } from '@/lib/scrollReturn';
import { Button } from './ui/button';

export function MobilePageNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = useFormReturn();
  const native = useCompanion();
  const scroll = useContext(ScrollReturnContext);
  const form = isFormPage(location.pathname);
  const book = matchPath('/books/:id', location.pathname);
  const author = matchPath('/authors/:id', location.pathname);
  if (!form && !book && !author) return null;
  const fallback = location.pathname.startsWith('/books') ? '/books' : location.pathname.startsWith('/authors') ? '/authors' : '/';
  function leave() {
    if (form) {
      clearFormDraft(location.pathname);
      returnTo(safeReturnTo(new URLSearchParams(location.search).get('returnTo'), fallback));
    } else if (scroll?.origin?.()) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }
  return <div className={`sticky top-0 z-20 border-b bg-background px-4 py-1 ${native ? '' : 'md:hidden'}`}>
    <Button type="button" variant="ghost" className="min-h-11" onClick={leave}>
      {!form && <ArrowLeft aria-hidden="true" />} {form ? 'Cancel' : 'Back'}
    </Button>
  </div>;
}
