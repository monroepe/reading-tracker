import { Link, type LinkProps } from 'react-router';
import { useFormReturn } from '@/hooks/useFormReturn';

export function FormCancelLink({ to, onClick, ...props }: LinkProps & { to: string }) {
  const returnTo = useFormReturn();
  return <Link {...props} to={to} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 &&
        !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
        (!props.target || props.target === '_self')) {
      event.preventDefault();
      returnTo(to);
    }
  }} />;
}
