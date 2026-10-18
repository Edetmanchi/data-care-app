"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import { Modal } from "./Modal";
import { useI18n } from "./providers/language";
import { useLocation } from "./providers/location";

type Place = { label: string; lat: number; lng: number };

/** Manual location entry plus "use my current location". */
export function LocationPicker() {
  const { t } = useI18n();
  const { pickerOpen, closePicker, status, detect, setManual } = useLocation();
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!pickerOpen) {
      setQ("");
      setPlaces(null);
    }
  }, [pickerOpen]);

  // Debounced lookup — Nominatim allows ~1 req/s.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) {
      setPlaces(null);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/location?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = await res.json();
        setPlaces(data.places ?? []);
      } catch {
        if (!ctrl.signal.aborted) setPlaces([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 650);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  const useGps = async () => {
    const loc = await detect();
    if (loc) closePicker();
  };

  return (
    <Modal open={pickerOpen} onClose={closePicker} title={t("loc.title")}>
      <button
        onClick={useGps}
        disabled={status === "detecting"}
        className="btn-pulse flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-semibold disabled:opacity-70"
      >
        {status === "detecting" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
        {status === "detecting" ? t("loc.detecting") : t("loc.useCurrent")}
      </button>

      {(status === "denied" || status === "unavailable") && (
        <p role="alert" className="mt-3 rounded-xl border border-alarm/30 bg-alarm/10 px-3 py-2 text-sm text-[#ffb3c1]">
          {status === "denied" ? t("loc.denied") : t("loc.unavailable")}
        </p>
      )}

      <div className="my-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <label className="flex h-13 items-center gap-2.5 rounded-2xl border border-line bg-void/60 px-4 focus-within:border-pulse/60">
        <Search className="h-5 w-5 shrink-0 text-mist" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("loc.enterPlaceholder")}
          className="h-12 w-full bg-transparent text-base text-ink placeholder:text-dim focus:outline-none"
          aria-label={t("loc.enterPlaceholder")}
        />
        {searching && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-pulse" />}
      </label>

      <ul className="scrollbar-thin mt-3 max-h-64 space-y-1 overflow-y-auto">
        {places?.length === 0 && !searching && <li className="px-2 py-3 text-sm text-mist">{t("loc.noMatches")}</li>}
        {places?.map((p) => (
          <li key={`${p.lat},${p.lng}`}>
            <button
              onClick={() => {
                setManual(p, q.trim());
                closePicker();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-pulse/10"
            >
              <MapPin className="h-4 w-4 shrink-0 text-pulse" />
              <span className="text-sm">{p.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
