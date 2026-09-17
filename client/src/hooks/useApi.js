import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Run an async fetcher and expose {data, error, loading, reload}. Keeps every
 * page from hand-rolling the same three pieces of state — and makes sure a
 * response that arrives after unmount is dropped instead of setting state.
 */
export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve(fetcher())
      .then((data) => alive.current && setState({ data, error: null, loading: false }))
      .catch((error) => alive.current && setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}
