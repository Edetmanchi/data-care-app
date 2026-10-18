"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { DictKey } from "@/lib/i18n";
import { Modal } from "./Modal";
import { useAuth } from "./providers/auth";
import { useI18n } from "./providers/language";

export function AuthModal() {
  const { t, lang } = useI18n();
  const { modal, closeAuth, setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (modal) {
      setMode(modal.mode);
      setError(null);
    }
  }, [modal]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form), language: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "generic");
        return;
      }
      setUser(data.user);
      closeAuth();
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  const errKey = (error ? `auth.err.${error}` : null) as DictKey | null;
  const title =
    modal?.reason === "prompt" ? t("auth.promptTitle") : mode === "login" ? t("auth.loginTitle") : t("auth.signupTitle");

  return (
    <Modal open={!!modal} onClose={closeAuth} title={title}>
      {modal?.reason === "prompt" && <p className="-mt-2 mb-5 text-sm leading-relaxed text-mist">{t("auth.promptBody")}</p>}
      {modal?.reason === "tracking" && <p className="-mt-2 mb-5 text-sm text-mist">{t("auth.trackingRequired")}</p>}

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && <Field name="name" label={t("auth.name")} autoComplete="name" />}
        <Field name="identifier" label={t("auth.identifier")} autoComplete="username" inputMode="email" />
        <Field
          name="password"
          type="password"
          label={t("auth.password")}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 6 : 1}
        />

        {errKey && (
          <p role="alert" className="rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-[#ffb3c1]">
            {t(errKey) === errKey ? t("auth.err.generic") : t(errKey)}
          </p>
        )}

        <button
          disabled={busy}
          className="btn-pulse mt-2 flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold disabled:opacity-70"
        >
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {mode === "login" ? t("auth.submitLogin") : t("auth.submitSignup")}
        </button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2 text-sm">
        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="text-pulse hover:underline"
        >
          {mode === "login" ? t("auth.switchToSignup") : t("auth.switchToLogin")}
        </button>
        {modal?.reason === "prompt" && (
          <button onClick={closeAuth} className="text-mist hover:text-ink">
            {t("auth.later")}
          </button>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-mist">{label}</span>
      <input
        required
        {...props}
        className="h-12 w-full rounded-xl border border-line bg-void/60 px-4 text-base text-ink placeholder:text-dim focus:border-pulse/60 focus:outline-none"
      />
    </label>
  );
}
