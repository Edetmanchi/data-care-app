"use client";

import { motion } from "framer-motion";
import { Navigation, Phone } from "lucide-react";
import { CATEGORY_COLOR, type Facility } from "@/lib/facility-types";
import { formatDistance } from "@/lib/client/format";
import { track } from "@/lib/client/track";
import { FACILITY_ICON } from "../facility-icons";
import { useI18n } from "../providers/language";

export function CategoryBadge({ category }: { category: Facility["category"] }) {
  const { t } = useI18n();
  const Icon = FACILITY_ICON[category];
  const c = CATEGORY_COLOR[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
      style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}
    >
      <Icon className="h-3 w-3" />
      {t(`type.${category}`)}
    </span>
  );
}

export function FacilityCard({
  facility: f,
  index,
  onSelect,
}: {
  facility: Facility;
  index: number;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.045, type: "spring", stiffness: 260, damping: 28 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-white/[0.015] p-4 transition hover:border-pulse/40 hover:bg-pulse/[0.04]"
      >
        <span
          className="absolute inset-y-3 left-0 w-[3px] rounded-r-full opacity-70 transition group-hover:opacity-100"
          style={{ background: CATEGORY_COLOR[f.category] }}
        />
        <div className="flex items-start gap-3">
          <span className="mt-0.5 font-mono text-xs text-dim">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <CategoryBadge category={f.category} />
              {f.ownership && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-dim">{f.ownership}</span>
              )}
              {index === 0 && (
                <span className="rounded-md bg-pulse/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-pulse">
                  {t("results.nearest")}
                </span>
              )}
            </div>
            <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">{f.name}</h3>
            {f.address && <p className="mt-0.5 truncate text-[13px] text-mist">{f.address}</p>}
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-semibold leading-none text-pulse">{formatDistance(f.distanceM)}</div>
            <div className="mt-1 text-[11px] text-dim">{t("results.away")}</div>
          </div>
        </div>

        <div className="mt-3 flex gap-2 pl-7">
          <span className="flex h-9 items-center gap-1.5 rounded-xl bg-pulse/12 px-3 text-[13px] font-medium text-pulse transition group-hover:bg-pulse/20">
            <Navigation className="h-3.5 w-3.5" />
            {t("results.directions")}
          </span>
          {f.phone && (
            <a
              href={`tel:${f.phone.split(/[;,]/)[0].replace(/\s/g, "")}`}
              onClick={(e) => {
                e.stopPropagation();
                track("call_facility", { facility_id: f.id, from: "card" });
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] text-mist transition hover:border-vital/50 hover:text-vital"
            >
              <Phone className="h-3.5 w-3.5" />
              {t("results.call")}
            </a>
          )}
        </div>
      </div>
    </motion.li>
  );
}
