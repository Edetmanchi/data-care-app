"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HTML_LANG, isLang, translate, type DictKey, type Lang } from "@/lib/i18n";
import { track } from "@/lib/client/track";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // English is the default on first visit; a stored choice wins afterwards.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dc_lang");
      if (isLang(stored)) setLangState(stored);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);

  const langRef = useRef(lang);
  langRef.current = lang;

  const setLang = useCallback((l: Lang) => {
    if (langRef.current === l) return;
    track("language_change", { from: langRef.current, to: l });
    setLangState(l);
    try {
      localStorage.setItem("dc_lang", l);
    } catch {}
    document.cookie = `dc_lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // Saved on the profile when signed in; harmless 400 otherwise.
    fetch("/api/auth/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: l }),
    }).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
