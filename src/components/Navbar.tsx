"use client";

import Link from "next/link";
import { ChevronDown, Languages, LoaderCircle, LogOut, MapPin, Phone } from "lucide-react";
import { LANGUAGES, isLang } from "@/lib/i18n";
import { track } from "@/lib/client/track";
import { LogoLockup } from "./Logo";
import { useAuth } from "./providers/auth";
import { useI18n } from "./providers/language";
import { useLocation } from "./providers/location";

export function Navbar() {
  const { t } = useI18n();
  const { user, openAuth, logout } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-8 pt-[max(10px,env(safe-area-inset-top))] sm:px-5">
      <nav className="glass mx-auto flex h-18 max-w-7xl items-center gap-2 rounded-2xl px-3 sm:gap-3 sm:px-4">
        <Link href="/" aria-label="Datacare Care home" className="shrink-0">
          <LogoLockup />
        </Link>

        <LocationChip />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <a
            href="tel:112"
            onClick={() => track("emergency_call", { number: "112" })}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-alarm/40 bg-alarm/10 px-2.5 font-mono text-xs font-bold text-alarm transition hover:bg-alarm/20"
            aria-label={t("emergency.call")}
            title={t("emergency.call")}
          >
            <Phone className="h-3.5 w-3.5" />
            112
          </a>

          <LanguageSelect />

          {user ? (
            <button
              onClick={logout}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-sm text-mist transition hover:text-ink"
              title={t("nav.logout")}
            >
              <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => openAuth("login", "nav")}
                className="hidden h-9 rounded-xl px-3 text-sm text-mist transition hover:text-ink sm:block"
              >
                {t("nav.login")}
              </button>
              <button
                onClick={() => openAuth("signup", "nav")}
                className="h-9 whitespace-nowrap rounded-xl border border-pulse/40 bg-pulse/10 px-3 text-sm font-medium text-pulse transition hover:bg-pulse/20"
              >
                {t("nav.signup")}
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function LocationChip() {
  const { t } = useI18n();
  const { status, location, openPicker } = useLocation();
  const busy = status === "detecting" && !location;
  const label = location?.label ?? (location ? `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}` : null);

  return (
    <button
      onClick={openPicker}
      className="group ml-1 hidden min-w-0 max-w-[260px] items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-1.5 text-left transition hover:border-pulse/40 md:flex"
    >
      {busy ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-pulse" />
      ) : (
        <MapPin className="h-4 w-4 shrink-0 text-pulse" />
      )}
      <span className="min-w-0">
        <span className="block font-mono text-[9px] uppercase tracking-[0.25em] text-dim">{t("search.locationLabel")}</span>
        <span className="block truncate text-[13px] text-ink">
          {busy ? t("loc.detecting") : (label ?? t("loc.unknown"))}
        </span>
      </span>
    </button>
  );
}

function LanguageSelect() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="relative flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-sm text-ink transition focus-within:border-pulse/60 hover:border-pulse/40">
      <Languages className="h-4 w-4 text-pulse" aria-hidden />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={lang}
        onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t("nav.language")}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-shell text-ink">
            {l.native}
          </option>
        ))}
      </select>
      <span className="font-mono text-xs uppercase">{lang}</span>
      <ChevronDown className="h-3.5 w-3.5 text-mist" aria-hidden />
    </label>
  );
}
