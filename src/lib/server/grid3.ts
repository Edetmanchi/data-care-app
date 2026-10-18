import "server-only";
import type { Facility, FacilityType } from "@/lib/facility-types";
import { haversine } from "./geo";

// GRID3 Nigeria health facilities v2 — built from the National Health Facility Registry (NHFR).
// Public ArcGIS feature service covering all 36 states + FCT (~51k facilities, incl. rural PHCs).
// (v3 has richer facility types but, as of Oct 2026, only 24 states — Lagos is missing.)
const ENDPOINT =
  "https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_health_facilities_v2_0/FeatureServer/0/query";

const nameLike = (...words: string[]) => words.map((w) => `UPPER(facility_name) LIKE '%${w}%'`).join(" OR ");

const MATERNAL_WORDS = ["MATERN", "WOMEN", "BIRTH", "OBSTET", "GYNAE", "GYNEC", "MOTHER", "MCH"];

const WHERE: Record<FacilityType, string> = {
  all: "1=1",
  hospital: `facility_level IN ('Secondary','Tertiary') OR ${nameLike("HOSPITAL", "MEDICAL CENT", "FMC")}`,
  phc: `facility_level = 'Primary' AND (${nameLike("PRIMARY HEALTH", "PHC", "HEALTH CENT", "HEALTH POST", "DISPENSARY", "HEALTH CLINIC", "BASIC HEALTH", "COMPREHENSIVE HEALTH", "MODEL HEALTH")})`,
  maternity: nameLike(...MATERNAL_WORDS),
  midwife: nameLike("MATERNITY HOME", "MIDWI", "BIRTH"),
  clinic: nameLike("CLINIC", "MEDICAL", "NURSING HOME", "MEDICARE"),
  lab: nameLike("LABORATOR", "DIAGNOS", "SCAN", "IMAGING"),
  pharmacy: nameLike("PHARMAC", "CHEMIST"),
};

/** Categories where the registry has meaningful coverage; pharmacies and midwives lean on OpenStreetMap. */
export const GRID3_PRIMARY: ReadonlySet<FacilityType> = new Set(["all", "hospital", "phc", "maternity", "clinic", "lab"]);

type Attrs = {
  nhfr_uid: string | null;
  globalid: string;
  facility_name: string;
  facility_level: string | null;
  ownership: string | null;
  ward: string | null;
  lga: string | null;
  state: string | null;
};

function classify(a: Attrs): Facility["category"] {
  const name = a.facility_name ?? "";
  if (/midwi/i.test(name)) return "midwife";
  if (new RegExp(MATERNAL_WORDS.join("|"), "i").test(name)) return "maternity";
  if (a.facility_level === "Secondary" || a.facility_level === "Tertiary" || /hospital|medical cent/i.test(name)) return "hospital";
  if (/pharmac|chemist/i.test(name)) return "pharmacy";
  if (/laborator|diagnos|scan|imaging/i.test(name)) return "lab";
  if (/primary health|\bphc\b|health cent|health post|dispensary|basic health|comprehensive health|model health/i.test(name)) return "phc";
  return "clinic";
}

const tidy = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 3 && t === t.toUpperCase() ? t.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : t;
};

export async function grid3Search(type: FacilityType, lat: number, lng: number, radiusM: number): Promise<Facility[]> {
  const params = new URLSearchParams({
    where: WHERE[type],
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(radiusM),
    units: "esriSRUnit_Meter",
    outFields: "nhfr_uid,globalid,facility_name,facility_level,ownership,ward,lga,state",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "1000",
    f: "json",
  });
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GRID3 ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`GRID3 ${json.error.code}: ${json.error.details?.join(" ") || json.error.message}`);

  const out: Facility[] = [];
  for (const { attributes: a, geometry: g } of json.features as { attributes: Attrs; geometry?: { x: number; y: number } }[]) {
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y) || !a.facility_name?.trim()) continue;
    const address = [a.ward, a.lga, a.state].filter((x, i, arr) => x && arr.indexOf(x) === i).join(", ");
    out.push({
      id: `grid3:${a.nhfr_uid || a.globalid}`,
      name: tidy(a.facility_name),
      category: classify(a),
      lat: g.y,
      lng: g.x,
      distanceM: Math.round(haversine(lat, lng, g.y, g.x)),
      phone: null,
      address: address || null,
      openingHours: null,
      emergency: false,
      ownership: a.ownership === "Public" || a.ownership === "Private" ? a.ownership : null,
      source: "grid3",
    });
  }
  return out.sort((x, y) => x.distanceM - y.distanceM);
}
