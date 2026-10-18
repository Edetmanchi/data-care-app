"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  Car,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Flag,
  Footprints,
  LoaderCircle,
  Navigation,
  Phone,
  Radio,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import type { Facility, RouteMode, RouteResponse, RouteStep } from "@/lib/facility-types";
import type { DictKey } from "@/lib/i18n";
import { formatDistance, formatDuration, googleMapsUrl } from "@/lib/client/format";
import { track } from "@/lib/client/track";
import { useI18n } from "../providers/language";
import { CategoryBadge } from "./FacilityCard";

function stepKey(s: RouteStep): DictKey {
  if (s.type === "depart") return "step.depart";
  if (s.type === "arrive") return "step.arrive";
  if (s.type === "roundabout" || s.type === "rotary" || s.type === "roundabout turn") return "step.roundabout";
  switch (s.modifier) {
    case "left":
    case "sharp left":
      return "step.left";
    case "right":
    case "sharp right":
      return "step.right";
    case "slight left":
      return "step.slightLeft";
    case "slight right":
      return "step.slightRight";
    case "uturn":
      return "step.uturn";
    default:
      return "step.straight";
  }
}

const STEP_ICON: Partial<Record<DictKey, React.ComponentType<{ className?: string }>>> = {
  "step.left": CornerUpLeft,
  "step.right": CornerUpRight,
  "step.slightLeft": CornerUpLeft,
  "step.slightRight": CornerUpRight,
  "step.uturn": RotateCcw,
  "step.roundabout": RotateCw,
  "step.arrive": Flag,
  "step.depart": Navigation,
};

export function DirectionsPanel({
  facility: f,
  origin,
  mode,
  onMode,
  route,
  routeStatus,
  live,
  onToggleLive,
  onBack,
}: {
  facility: Facility;
  origin: [number, number];
  mode: RouteMode;
  onMode: (m: RouteMode) => void;
  route: RouteResponse | null;
  routeStatus: "loading" | "ready" | "error";
  live: boolean;
  onToggleLive: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  // Collapse consecutive "continue" steps on the same road; keep it scannable.
  const steps = (route?.steps ?? []).filter((s, i, arr) => !(s.type === "new name" && arr[i - 1]?.name === s.name));

  return (
    <motion.div
      key={f.id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="flex h-full flex-col"
    >
      <div className="p-4 pb-3 md:p-5 md:pb-4">
        <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm text-mist transition hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          {t("results.back")}
        </button>
        <CategoryBadge category={f.category} />
        <h2 className="mt-2 font-display text-xl font-semibold leading-tight">{f.name}</h2>
        {f.address && <p className="mt-1 text-sm text-mist">{f.address}</p>}
        {f.openingHours === "24/7" && <p className="mt-1 font-mono text-xs text-vital">{t("facility.open24")}</p>}

        {/* mode switch */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-void/60 p-1">
          {(["driving", "walking"] as const).map((m) => {
            const Icon = m === "driving" ? Car : Footprints;
            return (
              <button
                key={m}
                onClick={() => onMode(m)}
                className={`relative flex h-10 items-center justify-center gap-2 rounded-xl text-sm transition ${
                  mode === m ? "text-void" : "text-mist hover:text-ink"
                }`}
              >
                {mode === m && (
                  <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-xl bg-pulse" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative font-medium">{m === "driving" ? t("dir.drive") : t("dir.walk")}</span>
              </button>
            );
          })}
        </div>

        {/* ETA readout */}
        <div className="mt-4 flex items-end justify-between rounded-2xl border border-line bg-gradient-to-br from-pulse/[0.08] to-transparent p-4">
          {routeStatus === "loading" ? (
            <span className="flex items-center gap-2 font-mono text-sm text-mist">
              <LoaderCircle className="h-4 w-4 animate-spin text-pulse" />
              {t("dir.loading")}
            </span>
          ) : route ? (
            <>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">ETA</div>
                <div className="text-glow font-display text-4xl font-bold leading-none text-pulse">
                  {formatDuration(route.durationS, t("common.min"))}
                </div>
              </div>
              <div className="text-right font-mono text-lg text-ink">{formatDistance(route.distanceM)}</div>
            </>
          ) : (
            <span className="text-sm text-[#ffb3c1]">{t("dir.failed")}</span>
          )}
        </div>

        {/* actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={googleMapsUrl(origin, [f.lat, f.lng], mode)}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("open_external_maps", { facility_id: f.id, mode })}
            className={`btn-pulse flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold ${f.phone ? "" : "col-span-2"}`}
          >
            <ExternalLink className="h-4 w-4" />
            {t("dir.openMaps")}
          </a>
          {f.phone && (
            <a
              href={`tel:${f.phone.split(/[;,]/)[0].replace(/\s/g, "")}`}
              onClick={() => track("call_facility", { facility_id: f.id, from: "directions" })}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-vital/40 bg-vital/10 text-sm font-semibold text-vital transition hover:bg-vital/20"
            >
              <Phone className="h-4 w-4" />
              {t("results.call")}
            </a>
          )}
          <button
            onClick={onToggleLive}
            className={`col-span-2 flex h-11 items-center justify-center gap-2 rounded-2xl border text-sm transition ${
              live ? "border-signal/60 bg-signal/15 text-signal" : "border-line text-mist hover:border-signal/50 hover:text-ink"
            }`}
          >
            <Radio className={`h-4 w-4 ${live ? "animate-pulse" : ""}`} />
            {live ? t("dir.stopLive") : t("dir.startLive")}
          </button>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-line px-4 pb-6 pt-3 md:px-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{t("dir.steps")}</div>
          <ol className="relative space-y-0.5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
            {steps.map((s, i) => {
              const key = stepKey(s);
              const Icon = STEP_ICON[key] ?? ArrowUp;
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.03 }}
                  className="relative flex items-start gap-3 py-2"
                >
                  <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-shell">
                    <Icon className="h-4 w-4 text-pulse" />
                  </span>
                  <span className="min-w-0 flex-1 pt-1 text-sm leading-snug">
                    {t(key)}
                    {s.name && s.type !== "arrive" && <span className="text-mist"> {t("step.onto", { road: s.name })}</span>}
                  </span>
                  {s.distanceM > 0 && <span className="pt-1 font-mono text-xs text-dim">{formatDistance(s.distanceM)}</span>}
                </motion.li>
              );
            })}
          </ol>
        </div>
      )}
    </motion.div>
  );
}
