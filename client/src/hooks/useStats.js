import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

export const DEFAULT_THRESHOLDS = { highThreshold: 70, mediumThreshold: 40 };

export function useStats() {
  const [state, setState] = useState({ stats: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const stats = await api.getStats();
      setState({ stats, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...state, refresh, thresholds: state.stats?.scoring || DEFAULT_THRESHOLDS };
}
