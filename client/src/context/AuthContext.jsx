import { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { api, setAccessToken, setSessionExpiredHandler } from '../api/client';
import { loginRequest, logoutRequest, registerRequest, meRequest } from '../api/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  // Set on every mount, not just the first: StrictMode mounts, unmounts and
  // remounts in development, and without re-arming here the ref would stay
  // false forever and silently swallow every later refresh.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applySession = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (email, password) => applySession(await loginRequest(email, password)),
    [applySession]
  );

  const register = useCallback(
    async (payload) => applySession(await registerRequest(payload)),
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAccessToken(null);
      setUser(null);
      setDueCount(0);
    }
  }, []);

  /**
   * Every graded answer returns the learner new XP total. Folding it in here
   * keeps the header counter honest mid-lesson instead of showing a stale
   * number until the lesson ends.
   */
  const applyXp = useCallback((totalXp) => {
    if (!Number.isFinite(totalXp)) return;
    setUser((current) => (current && totalXp !== current.xp ? { ...current, xp: totalXp } : current));
  }, []);

  /** Pull fresh XP/streak/due counts after finishing a lesson or review. */
  const refreshUser = useCallback(async () => {
    try {
      const data = await meRequest();
      if (!mounted.current) return;
      setUser(data.user);
      setDueCount(data.dueCount);
    } catch {
      /* a transient failure here should never blank the UI */
    }
  }, []);

  // On mount, trade the httpOnly refresh cookie for an access token so a page
  // reload does not look like a logout.
  useEffect(() => {
    let cancelled = false;
    api
      .refresh()
      .then(async (data) => {
        if (cancelled) return;
        setUser(data.user);
        const me = await meRequest().catch(() => null);
        if (!cancelled && me) setDueCount(me.dueCount);
      })
      .catch(() => {}) // no valid cookie — stay logged out, this is the normal first visit
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A refresh token that expires or is revoked mid-session logs the user out
  // rather than leaving the app stuck retrying.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setDueCount(0);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      dueCount,
      setDueCount,
      loading,
      login,
      register,
      logout,
      refreshUser,
      applyXp,
    }),
    [user, dueCount, loading, login, register, logout, refreshUser, applyXp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
