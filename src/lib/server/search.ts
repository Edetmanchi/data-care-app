import "server-only";
import type { Facility, FacilityType } from "@/lib/facility-types";
import { haversine } from "./geo";
import { GRID3_PRIMARY, grid3Search } from "./grid3";
import { overpassSearch } from "./osm";

// Widen the registry search until enough options appear — rural users may be far from any facility.
const GRID3_RADII = [3000, 10000, 30000, 80000];
const MIN_RESULTS = 5;
const MAX_RESULTS = 60;
// Once the registry has answered, how much longer to wait for OpenStreetMap extras.
// Pharmacies/midwives depend on OSM, so they get more patience.
const OSM_GRACE_MS = { primary: 2000, osmLed: 7000 };

const nameKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(the|of|and|ltd|limited|nig|nigeria)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

function sameFacility(a: Facility, b: Facility) {
  if (haversine(a.lat, a.lng, b.lat, b.lng) > 250) return false;
  const x = nameKey(a.name);
  const y = nameKey(b.name);
  return x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x) || x.slice(0, 10) === y.slice(0, 10));
}

/** Rejects after ms, whether or not the underlying fetch honours its abort signal. */
function deadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))]);
}

export type SearchResult = { facilities: Facility[]; radiusM: number };

/**
 * Registry data (GRID3/NHFR) is the backbone; OpenStreetMap runs in parallel to add pharmacies,
 * midwives, phone numbers and opening hours. Rejects only if both sources fail.
 */
export async function searchFacilities(type: FacilityType, lat: number, lng: number): Promise<SearchResult> {
  const osmRadius = type === "all" ? 8000 : 15000;
  const osmP = overpassSearch(type, lat, lng, osmRadius);
  osmP.catch(() => {}); // avoid unhandled rejection if we stop waiting for it

  const gridP = (async () => {
    let found: Facility[] = [];
    let radius = GRID3_RADII[0];
    for (const r of GRID3_RADII) {
      radius = r;
      found = await grid3Search(type, lat, lng, r);
      if (found.length >= MIN_RESULTS) break;
    }
    return { found, radius };
  })();

  const grid = await gridP.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  if (!grid.ok) console.error("[datacare] GRID3 failed:", grid.e);

  const grace = grid.ok && GRID3_PRIMARY.has(type) ? OSM_GRACE_MS.primary : OSM_GRACE_MS.osmLed;
  const osm = await deadline(osmP, grace).then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  if (!osm.ok) console.warn("[datacare] OSM skipped:", String(osm.e));
  if (!grid.ok && !osm.ok) throw new Error("all facility sources failed");

  const merged: Facility[] = grid.ok ? [...grid.v.found] : [];
  let radiusM = grid.ok ? grid.v.radius : 0;

  if (osm.ok && osm.v.length) {
    radiusM = Math.max(radiusM, osmRadius);
    for (const f of osm.v) {
      const twin = merged.find((g) => g.source === "grid3" && sameFacility(g, f));
      if (twin) {
        twin.phone ??= f.phone;
        twin.openingHours ??= f.openingHours;
        twin.emergency ||= f.emergency;
      } else {
        merged.push(f);
      }
    }
  }

  merged.sort((a, b) => a.distanceM - b.distanceM);
  return { facilities: merged.slice(0, MAX_RESULTS), radiusM: radiusM || osmRadius };
}
