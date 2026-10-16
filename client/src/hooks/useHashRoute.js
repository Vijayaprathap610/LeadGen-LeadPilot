import { useCallback, useEffect, useState } from 'react';

export const ROUTES = ['dashboard', 'leads', 'import'];

const read = () => {
  const name = window.location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(name) ? name : 'dashboard';
};

/** Minimal hash router: three views don't justify a routing dependency. */
export function useHashRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((name) => { window.location.hash = `/${name}`; }, []);
  return [route, navigate];
}
