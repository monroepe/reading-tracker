import { Link, useLocation, type LinkProps } from 'react-router';
import { withParam } from '@/lib/navigation';
import { useContext } from 'react';
import { ScrollReturnContext } from '@/lib/scrollReturn';

/** Records the page that opened a form so Save and Cancel can both return to it. */
export function FormLink({ to, onClick, ...props }: Omit<LinkProps, 'to'> & { to: string }) {
  const location = useLocation();
  const scrollReturn = useContext(ScrollReturnContext);
  const returnTo = location.pathname + location.search + location.hash;

  return <Link {...props} state={{ ...props.state, formOrigin: returnTo }} to={withParam(to, 'returnTo', returnTo)} onClick={(event) => {
    onClick?.(event);
    if (
      !event.defaultPrevented && event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
      (!props.target || props.target === '_self') && !props.reloadDocument &&
      props.download === undefined
    ) {
      scrollReturn?.capture(location);
    }
  }} />;
}
