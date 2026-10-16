import { useCallback, useEffect, useState } from 'react';
import { api, isCancel } from '../services/api';

/** Fetches one page of leads whenever the params change; cancels superseded requests. */
export function useLeads(params) {
  const [state, setState] = useState({ leads: [], pagination: null, loading: true, error: null });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api.getLeads(JSON.parse(key), controller.signal)
      .then((res) => setState({ leads: res.data, pagination: res.pagination, loading: false, error: null }))
      .catch((err) => {
        if (isCancel(err)) return;
        setState((s) => ({ ...s, loading: false, error: err.message }));
      });
    return () => controller.abort();
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const patchLead = useCallback((lead) => {
    setState((s) => ({ ...s, leads: s.leads.map((l) => (l._id === lead._id ? lead : l)) }));
  }, []);

  return { ...state, reload, patchLead };
}
