import { useLocation, useNavigate } from 'react-router';

/** Pop only when this form was opened from the requested destination. */
export function useFormReturn() {
  const location = useLocation();
  const navigate = useNavigate();
  return (target: string) => {
    if (location.state?.formOrigin === target) {
      navigate(-1);
    } else {
      navigate(target, { replace: true });
    }
  };
}
