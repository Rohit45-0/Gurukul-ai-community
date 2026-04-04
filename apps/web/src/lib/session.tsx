"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMe } from "./api";
import type { SessionSummary } from "./types";

const TOKEN_STORAGE_KEY = "community-ai.token";

interface SessionContextValue {
  token: string | null;
  user: SessionSummary | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => void;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existingToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!existingToken) {
      setLoading(false);
      return;
    }

    setToken(existingToken);
    void getMe(existingToken)
      .then((session) => {
        setUser(session);
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    const session = await getMe(token);
    setUser(session);
  }, [token]);

  const signIn = useCallback(async (nextToken: string) => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setLoading(true);
    try {
      const session = await getMe(nextToken);
      setUser(session);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      signIn,
      signOut,
      refreshSession,
    }),
    [loading, refreshSession, signIn, signOut, token, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return context;
}
