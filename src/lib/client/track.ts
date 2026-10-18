"use client";

type Props = Record<string, string | number | boolean | null>;

/** Fire-and-forget interaction log. Never throws, never blocks the UI. */
export function track(name: string, props?: Props) {
  try {
    const body = JSON.stringify({
      name,
      path: location.pathname,
      lang: localStorage.getItem("dc_lang") ?? "en",
      props,
    });
    if (!navigator.sendBeacon?.("/api/track", body)) {
      fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the app */
  }
}
