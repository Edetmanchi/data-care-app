"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/client/track";
import { isLang } from "@/lib/i18n";
import { useI18n } from "./language";

export type User = { id: string; name: string | null; language: string };
export type AuthMode = "login" | "signup";
export type AuthReason = "nav" | "prompt" | "tracking";

type Ctx = {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
  modal: { mode: AuthMode; reason: AuthReason } | null;
  openAuth: (mode: AuthMode, reason: AuthReason) => void;
  closeAuth: () => void;
  /** Call once directions are shown; prompts sign-up ~3 minutes later if still anonymous. */
  armSignupPrompt: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

const PROMPT_DELAY_MS = 3 * 60 * 1000;
const PROMPT_DUE = "dc_prompt_due";
const PROMPT_DONE = "dc_prompt_done";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useI18n();
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<Ctx["modal"]>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const setUser = useCallback(
    (u: User | null) => {
      setUserState(u);
      // Keep the account's saved language in sync with what the user is reading now.
      if (u && isLang(u.language) && u.language !== lang && !localStorage.getItem("dc_lang")) setLang(u.language);
    },
    [lang, setLang],
  );

  const showPrompt = useCallback(() => {
    try {
      sessionStorage.removeItem(PROMPT_DUE);
      if (userRef.current || sessionStorage.getItem(PROMPT_DONE)) return;
      sessionStorage.setItem(PROMPT_DONE, "1");
    } catch {}
    setModal((m) => m ?? { mode: "signup", reason: "prompt" });
    track("auth_prompt_shown");
  }, []);

  const schedule = useCallback(
    (due: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(showPrompt, Math.max(0, due - Date.now()));
    },
    [showPrompt],
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserState(d.user ?? null))
      .catch(() => {})
      .finally(() => setReady(true));
    // Resume a pending prompt after navigation/reload within the same tab session.
    try {
      const due = Number(sessionStorage.getItem(PROMPT_DUE));
      if (due) schedule(due);
    } catch {}
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule]);

  const armSignupPrompt = useCallback(() => {
    try {
      if (userRef.current || sessionStorage.getItem(PROMPT_DONE) || sessionStorage.getItem(PROMPT_DUE)) return;
      const due = Date.now() + PROMPT_DELAY_MS;
      sessionStorage.setItem(PROMPT_DUE, String(due));
      schedule(due);
    } catch {}
  }, [schedule]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    track("logout");
    setUserState(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      ready,
      setUser,
      logout,
      modal,
      openAuth: (mode, reason) => {
        setModal({ mode, reason });
        track("auth_open", { mode, reason });
      },
      closeAuth: () => {
        if (modal?.reason === "prompt") track("auth_prompt_dismissed");
        setModal(null);
      },
      armSignupPrompt,
    }),
    [user, ready, setUser, logout, modal, armSignupPrompt],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
