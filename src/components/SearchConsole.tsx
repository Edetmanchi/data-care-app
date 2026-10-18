"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import { FACILITY_TYPES, type FacilityType } from "@/lib/facility-types";
import { FACILITY_ICON, FACILITY_SYNONYMS } from "./facility-icons";
import { useI18n } from "./providers/language";
import { useLocation } from "./providers/location";

const QUICK: FacilityType[] = ["phc", "hospital", "maternity", "midwife", "pharmacy"];

export function SearchConsole() {
  const { t } = useI18n();
  const router = useRouter();
  const { location, status, detect, openPicker, pickerOpen } = useLocation();
  const [type, setType] = useState<FacilityType>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...FACILITY_TYPES];
    return FACILITY_TYPES.filter((ft) => `${t(`type.${ft}`)} ${FACILITY_SYNONYMS[ft]}`.toLowerCase().includes(q));
  }, [query, t]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener("pointerdown", onDown);
    return () => removeEventListener("pointerdown", onDown);
  }, []);

  const go = (ft: FacilityType, loc = location) => {
    if (!loc) return false;
    const p = new URLSearchParams({ type: ft, lat: loc.lat.toFixed(5), lng: loc.lng.toFixed(5) });
    router.push(`/search?${p}`);
    return true;
  };

  // If the user had to enter a location first, continue the search as soon as it arrives.
  useEffect(() => {
    if (pending && location && status === "ready") {
      setPending(false);
      go(type, location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, location, status]);

  // Picker dismissed without choosing a place: stop waiting.
  const wasPickerOpen = useRef(pickerOpen);
  useEffect(() => {
    if (wasPickerOpen.current && !pickerOpen && !location) setPending(false);
    wasPickerOpen.current = pickerOpen;
  }, [pickerOpen, location]);

  const submit = async (ft = type) => {
    if (go(ft)) return;
    setPending(true);
    const loc = await detect();
    if (!loc) openPicker();
  };

  const choose = (ft: FacilityType) => {
    setType(ft);
    setQuery("");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const ft = open && options[active] ? options[active] : type;
      choose(ft);
      submit(ft);
    } else if (e.key === "Escape") setOpen(false);
  };

  const TypeIcon = FACILITY_ICON[type];
  const busy = pending || (status === "detecting" && !location);

  return (
    <div className="w-full">
      <div ref={boxRef} className="glass reticle relative rounded-[22px] p-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
          {/* facility type combobox */}
          <div className="relative flex-1">
            <label className="flex h-14 items-center gap-3 rounded-2xl bg-void/50 px-4 transition focus-within:bg-void/80">
              <TypeIcon className="h-5 w-5 shrink-0 text-pulse" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[9px] uppercase tracking-[0.28em] text-dim">{t("search.typeLabel")}</span>
                <input
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="facility-type-list"
                  aria-autocomplete="list"
                  value={open ? query : t(`type.${type}`)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                    setOpen(true);
                  }}
                  onFocus={() => {
                    setOpen(true);
                    setQuery("");
                  }}
                  onKeyDown={onKey}
                  placeholder={t(`type.${type}`)}
                  className="w-full truncate bg-transparent text-[15px] font-medium text-ink placeholder:text-mist focus:outline-none"
                />
              </span>
              <ChevronDown className={`h-4 w-4 text-mist transition ${open ? "rotate-180" : ""}`} aria-hidden />
            </label>

            <AnimatePresence>
              {open && options.length > 0 && (
                <motion.ul
                  id="facility-type-list"
                  role="listbox"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="glass absolute inset-x-0 top-[calc(100%+8px)] z-30 max-h-80 overflow-y-auto rounded-2xl p-1.5"
                >
                  {options.map((ft, i) => {
                    const Icon = FACILITY_ICON[ft];
                    return (
                      <li
                        key={ft}
                        role="option"
                        aria-selected={ft === type}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          choose(ft);
                        }}
                        onMouseEnter={() => setActive(i)}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          i === active ? "bg-pulse/12 text-ink" : "text-mist"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-pulse" />
                        {t(`type.${ft}`)}
                        {ft === type && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-pulse" />}
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          {/* location segment */}
          <button
            onClick={openPicker}
            className="flex h-14 items-center gap-3 rounded-2xl bg-void/50 px-4 text-left transition hover:bg-void/80 md:w-64"
          >
            {status === "detecting" && !location ? (
              <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-pulse" />
            ) : location ? (
              <MapPin className="h-5 w-5 shrink-0 text-pulse" />
            ) : (
              <LocateFixed className="h-5 w-5 shrink-0 text-mist" />
            )}
            <span className="min-w-0">
              <span className="block font-mono text-[9px] uppercase tracking-[0.28em] text-dim">{t("search.locationLabel")}</span>
              <span className="block truncate text-[15px] text-ink">
                {status === "detecting" && !location
                  ? t("loc.detecting")
                  : location
                    ? (location.label ?? `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`)
                    : t("loc.unknown")}
              </span>
            </span>
          </button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => submit()}
            disabled={busy}
            className="btn-pulse flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-base font-semibold disabled:opacity-80 md:px-7"
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {t("search.cta")}
            {!busy && <ArrowRight className="h-5 w-5" />}
          </motion.button>
        </div>
      </div>

      {/* quick picks */}
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:justify-center md:px-0">
        {QUICK.map((ft, i) => {
          const Icon = FACILITY_ICON[ft];
          return (
            <motion.button
              key={ft}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.07 }}
              onClick={() => {
                setType(ft);
                submit(ft);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition ${
                type === ft
                  ? "border-pulse/60 bg-pulse/15 text-ink"
                  : "border-line bg-white/[0.02] text-mist hover:border-pulse/40 hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-pulse" />
              {t(`type.${ft}`)}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
