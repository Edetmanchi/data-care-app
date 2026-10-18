"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, MapPin, RefreshCw, SearchX } from "lucide-react";
import {
  FACILITY_TYPES,
  isFacilityType,
  type Facility,
  type FacilityType,
  type RouteMode,
  type RouteResponse,
  type SearchResponse,
} from "@/lib/facility-types";
import { track } from "@/lib/client/track";
import { FACILITY_ICON } from "@/components/facility-icons";
import { useAuth } from "@/components/providers/auth";
import { useI18n } from "@/components/providers/language";
import { useLocation } from "@/components/providers/location";
import { DirectionsPanel } from "@/components/results/DirectionsPanel";
import { FacilityCard } from "@/components/results/FacilityCard";

const FacilityMap = dynamic(() => import("@/components/map/FacilityMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-void" />,
});

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <Results />
    </Suspense>
  );
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

const metersBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111_000, (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180));

function Results() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { location, status: locStatus, openPicker } = useLocation();
  const { user, openAuth, armSignupPrompt } = useAuth();
  const desktop = useIsDesktop();

  const type: FacilityType = isFacilityType(params.get("type")) ? (params.get("type") as FacilityType) : "all";
  const pLat = Number(params.get("lat"));
  const pLng = Number(params.get("lng"));
  const urlOrigin = params.get("lat") && Number.isFinite(pLat) && Number.isFinite(pLng) ? { lat: pLat, lng: pLng } : null;

  // ---- keep the URL in sync with the chosen location ----
  // A remembered location from a previous visit must not override coordinates already in the URL.
  useEffect(() => {
    if (location?.method === "saved" && urlOrigin) return;
    if (!location) {
      if (!urlOrigin && (locStatus === "denied" || locStatus === "unavailable")) openPicker();
      return;
    }
    if (!urlOrigin || metersBetween(urlOrigin, location) > 300) {
      const p = new URLSearchParams({ type, lat: location.lat.toFixed(5), lng: location.lng.toFixed(5) });
      router.replace(`/search?${p}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, locStatus]);

  const origin = urlOrigin;

  // ---- search ----
  const [data, setData] = useState<SearchResponse | null>(null);
  const [searchState, setSearchState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!origin) return;
    const ctrl = new AbortController();
    setSearchState("loading");
    setSelectedId(null);
    const q = new URLSearchParams({ type, lat: String(origin.lat), lng: String(origin.lng), lang });
    fetch(`/api/facilities?${q}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SearchResponse) => {
        setData(d);
        setSearchState("ready");
      })
      .catch(() => !ctrl.signal.aborted && setSearchState("error"));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, origin?.lat, origin?.lng, attempt]);

  const facilities = useMemo(() => data?.facilities ?? [], [data]);

  // ---- selection + routing ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<RouteMode>("driving");
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeStatus, setRouteStatus] = useState<"loading" | "ready" | "error">("loading");
  const selected = facilities.find((f) => f.id === selectedId) ?? null;

  useEffect(() => {
    setRoute(null);
    if (!selected || !origin) return;
    const ctrl = new AbortController();
    setRouteStatus("loading");
    fetch("/api/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        from: [origin.lat, origin.lng],
        to: [selected.lat, selected.lng],
        mode,
        facilityId: selected.id,
        facilityName: selected.name,
        searchId: data?.searchId ?? null,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r: RouteResponse) => {
        setRoute(r);
        setRouteStatus("ready");
        armSignupPrompt();
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setRouteStatus("error");
        armSignupPrompt();
      });
    return () => ctrl.abort();
    // Live-tracking position updates should not re-request the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, mode]);

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSheetOpen(false);
      track("facility_select", { facility_id: id });
    },
    [],
  );

  // ---- live tracking (signed-in users) ----
  const [live, setLive] = useState(false);
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const lastPing = useRef(0);

  useEffect(() => {
    if (!live) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLivePos(p);
        if (Date.now() - lastPing.current > 60_000) {
          lastPing.current = Date.now();
          fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "tracking", ...p, accuracy: pos.coords.accuracy }),
          }).catch(() => {});
        }
      },
      () => setLive(false),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [live]);

  // Turn tracking on automatically once the user signs in from the tracking prompt.
  const wantsLive = useRef(false);
  useEffect(() => {
    if (user && wantsLive.current) {
      wantsLive.current = false;
      setLive(true);
      track("live_tracking_start");
    }
  }, [user]);

  const toggleLive = () => {
    if (live) {
      setLive(false);
      setLivePos(null);
      track("live_tracking_stop");
      return;
    }
    if (!user) {
      wantsLive.current = true;
      openAuth("signup", "tracking");
      return;
    }
    setLive(true);
    track("live_tracking_start");
  };

  // ---- layout ----
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const [panelH, setPanelH] = useState(0);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padding = useMemo(
    () =>
      desktop
        ? { top: 100, bottom: 50, left: 480, right: 70 }
        : { top: 90, bottom: Math.min(panelH, 520) + 20, left: 40, right: 40 },
    [desktop, panelH],
  );

  const setType = (ft: FacilityType) => {
    if (!origin) return;
    router.replace(`/search?${new URLSearchParams({ type: ft, lat: String(origin.lat), lng: String(origin.lng) })}`);
  };

  const mapOrigin = livePos ?? origin;

  return (
    <main className="fixed inset-0 overflow-hidden">
      {mapOrigin ? (
        <FacilityMap
          origin={mapOrigin}
          facilities={facilities}
          selectedId={selectedId}
          route={route?.geometry ?? null}
          padding={padding}
          follow={live}
          onSelect={select}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <button onClick={openPicker} className="btn-pulse flex h-14 items-center gap-2 rounded-2xl px-6 font-semibold">
            <MapPin className="h-5 w-5" />
            {t("loc.unknown")}
          </button>
        </div>
      )}

      {/* scanning overlay */}
      <AnimatePresence>
        {origin && searchState === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="pointer-events-none absolute inset-0 grid place-items-center md:pl-[440px]"
          >
            <div className="relative h-72 w-72 max-md:-translate-y-24">
              <div className="absolute inset-0 rounded-full border border-pulse/25" />
              <div className="absolute inset-[18%] rounded-full border border-pulse/20" />
              <div className="absolute inset-[36%] rounded-full border border-pulse/15" />
              <div
                className="animate-radar absolute inset-0 rounded-full"
                style={{ background: "conic-gradient(from 0deg, rgba(46,230,201,0.45), transparent 80deg)" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* floating panel: left rail on desktop, bottom sheet on mobile */}
      <motion.section
        ref={panelRef}
        layout
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
        className={`glass absolute z-20 flex flex-col overflow-hidden ${
          desktop
            ? "bottom-4 left-4 top-[84px] w-[440px] rounded-3xl"
            : `inset-x-0 bottom-0 rounded-t-3xl pb-[env(safe-area-inset-bottom)] ${
                selected ? "max-h-[52dvh]" : sheetOpen ? "h-[78dvh]" : "h-[46dvh]"
              }`
        }`}
      >
        {!desktop && !selected && (
          <button
            onClick={() => setSheetOpen((o) => !o)}
            className="flex w-full shrink-0 items-center justify-center pt-2.5"
            aria-label="Expand results"
          >
            <span className="h-1.5 w-11 rounded-full bg-white/20" />
            <ChevronUp className={`absolute right-4 top-2 h-4 w-4 text-dim transition ${sheetOpen ? "rotate-180" : ""}`} />
          </button>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {selected && origin ? (
            <DirectionsPanel
              key="dir"
              facility={selected}
              origin={[(livePos ?? origin).lat, (livePos ?? origin).lng]}
              mode={mode}
              onMode={setMode}
              route={route}
              routeStatus={routeStatus}
              live={live}
              onToggleLive={toggleLive}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <ResultsHeader
                type={type}
                onType={setType}
                state={searchState}
                data={data}
                label={location?.label ?? null}
                onChangeLocation={openPicker}
              />
              <ResultsList
                state={searchState}
                facilities={facilities}
                onSelect={select}
                onRetry={() => setAttempt((a) => a + 1)}
                onAll={() => setType("all")}
                isAll={type === "all"}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}

function ResultsHeader({
  type,
  onType,
  state,
  data,
  label,
  onChangeLocation,
}: {
  type: FacilityType;
  onType: (t: FacilityType) => void;
  state: "loading" | "ready" | "error";
  data: SearchResponse | null;
  label: string | null;
  onChangeLocation: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="shrink-0 border-b border-line px-4 pb-3 pt-3 md:px-5 md:pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-pulse md:tracking-[0.3em]">
            <span className={`h-1.5 w-1.5 rounded-full ${state === "loading" ? "animate-blink bg-alarm" : "bg-pulse"}`} />
            {state === "loading" ? "SCANNING" : state === "error" ? "SIGNAL LOST" : "SCAN COMPLETE"}
            {state === "ready" && data && <span className="text-dim">· {t("results.within", { km: data.radiusM / 1000 })}</span>}
          </div>
          <h1 className="mt-1 font-display text-lg font-semibold">
            {state === "loading"
              ? t("results.scanning")
              : state === "ready"
                ? t("results.found", { n: data?.facilities.length ?? 0 })
                : t("results.error")}
          </h1>
        </div>
        <button
          onClick={onChangeLocation}
          className="flex max-w-[45%] shrink-0 items-center gap-1.5 rounded-xl border border-line px-2.5 py-1.5 text-xs text-mist transition hover:border-pulse/40 hover:text-ink"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-pulse" />
          <span className="truncate">{label ?? t("loc.change")}</span>
        </button>
      </div>
      {data?.source === "cache" && <p className="mt-1 text-xs text-[#ffd166]">{t("results.cached")}</p>}

      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 md:-mx-5 md:px-5">
        {FACILITY_TYPES.map((ft) => {
          const Icon = FACILITY_ICON[ft];
          const on = ft === type;
          return (
            <button
              key={ft}
              onClick={() => onType(ft)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                on ? "border-pulse/60 bg-pulse/15 text-ink" : "border-line text-mist hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-pulse" />
              {t(`type.${ft}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultsList({
  state,
  facilities,
  onSelect,
  onRetry,
  onAll,
  isAll,
}: {
  state: "loading" | "ready" | "error";
  facilities: Facility[];
  onSelect: (id: string) => void;
  onRetry: () => void;
  onAll: () => void;
  isAll: boolean;
}) {
  const { t } = useI18n();

  if (state === "loading") {
    return (
      <div className="flex-1 space-y-3 overflow-hidden p-4 md:p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-white/[0.02]" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-mist">{t("results.error")}</p>
        <button onClick={onRetry} className="btn-pulse flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold">
          <RefreshCw className="h-4 w-4" />
          {t("results.retry")}
        </button>
        <a href="tel:112" className="text-sm font-semibold text-alarm">
          {t("emergency.call")}
        </a>
      </div>
    );
  }

  if (!facilities.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <SearchX className="h-10 w-10 text-dim" />
        <p className="font-medium">{t("results.none")}</p>
        <p className="text-sm text-mist">{t("results.noneHint")}</p>
        {!isAll && (
          <button onClick={onAll} className="mt-2 rounded-xl border border-pulse/40 px-4 py-2 text-sm text-pulse">
            {t("type.all")}
          </button>
        )}
        <a href="tel:112" className="mt-2 text-sm font-semibold text-alarm">
          {t("emergency.call")}
        </a>
      </div>
    );
  }

  return (
    <ul className="scrollbar-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 md:p-5">
      {facilities.map((f, i) => (
        <FacilityCard key={f.id} facility={f} index={i} onSelect={() => onSelect(f.id)} />
      ))}
      <li className="py-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{"// end of scan"}</li>
    </ul>
  );
}
