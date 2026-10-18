"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type LocationMethod = "gps" | "manual" | "saved";
export type LocationStatus = "idle" | "detecting" | "ready" | "denied" | "unavailable";

export type UserLocation = {
  lat: number;
  lng: number;
  label: string | null;
  method: LocationMethod;
  accuracy?: number;
};

type Ctx = {
  status: LocationStatus;
  location: UserLocation | null;
  detect: () => Promise<UserLocation | null>;
  setManual: (loc: { lat: number; lng: number; label: string }, query?: string) => void;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
};

const LocationContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "dc_last_location";

function save(loc: UserLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loc, savedAt: Date.now() }));
  } catch {}
}

function post(body: Record<string, unknown>) {
  return fetch("/api/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

const GEO_ERRORS: Record<number, string> = { 1: "permission_denied", 2: "position_unavailable", 3: "timeout" };

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inflight = useRef<Promise<UserLocation | null> | null>(null);

  const detect = useCallback(() => {
    if (inflight.current) return inflight.current;
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      post({ method: "gps", error: "unsupported" });
      return Promise.resolve(null);
    }
    setStatus("detecting");
    inflight.current = new Promise<UserLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const base: UserLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            label: null,
            method: "gps",
          };
          setLocation(base);
          setStatus("ready");
          resolve(base);
          const res = await post({ method: "gps", lat: base.lat, lng: base.lng, accuracy: base.accuracy, reverse: true });
          const withLabel = { ...base, label: res?.place?.label ?? null };
          setLocation((cur) => (cur && cur.method === "gps" && cur.lat === base.lat ? withLabel : cur));
          save(withLabel);
        },
        (err) => {
          setStatus(err.code === 1 ? "denied" : "unavailable");
          post({ method: "gps", error: GEO_ERRORS[err.code] ?? "unknown" });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    }).finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, []);

  const setManual = useCallback<Ctx["setManual"]>((loc, query) => {
    const next: UserLocation = { ...loc, method: "manual" };
    setLocation(next);
    setStatus("ready");
    save(next);
    post({ method: "manual", lat: loc.lat, lng: loc.lng, label: loc.label, query });
  }, []);

  // App open: show the last known place instantly, then try to detect the live position.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setLocation({ lat: saved.lat, lng: saved.lng, label: saved.label, method: "saved" });
        setStatus("ready");
      }
    } catch {}

    (async () => {
      try {
        const perm = await navigator.permissions?.query({ name: "geolocation" });
        if (perm?.state === "denied") {
          setStatus((s) => (s === "ready" ? s : "denied"));
          return;
        }
      } catch {}
      detect();
    })();
  }, [detect]);

  const value = useMemo<Ctx>(
    () => ({
      status,
      location,
      detect,
      setManual,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
    }),
    [status, location, detect, setManual, pickerOpen],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used inside LocationProvider");
  return ctx;
}
