import "server-only";
import type { Facility, FacilityType, RouteMode, RouteResponse } from "@/lib/facility-types";
import { haversine } from "./geo";

const USER_AGENT = `DatacareCare/1.0 (${process.env.OSM_CONTACT_EMAIL || "maternal-health-locator"})`;

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const MATERNAL_NAME = "[Mm]aternity|[Mm]aternal|[Bb]irth|[Mm]idwi|[Aa]nte-?natal|[Ww]omen|[Oo]bstetric|[Gg]ynae";
const PHC_NAME = "[Pp]rimary [Hh]ealth|PHC|[Hh]ealth [Cc]ent|[Hh]ealth [Pp]ost|[Cc]omprehensive [Hh]ealth";

/** Overpass selectors for each category. `A` is the `(around:...)` filter. */
function selectors(type: FacilityType, A: string): string[] {
  const byType: Record<Exclude<FacilityType, "all">, string[]> = {
    hospital: [`nwr${A}[amenity=hospital]`, `nwr${A}[healthcare=hospital]`],
    phc: [
      `nwr${A}[healthcare=centre]`,
      `nwr${A}[amenity=clinic][name~"${PHC_NAME}"]`,
      `nwr${A}[healthcare=clinic][name~"${PHC_NAME}"]`,
    ],
    clinic: [`nwr${A}[amenity=clinic]`, `nwr${A}[healthcare=clinic]`, `nwr${A}[amenity=doctors]`],
    pharmacy: [`nwr${A}[amenity=pharmacy]`, `nwr${A}[healthcare=pharmacy]`, `nwr${A}[shop=chemist]`],
    midwife: [
      `nwr${A}[healthcare=midwife]`,
      `nwr${A}[healthcare=birthing_centre]`,
      `nwr${A}[amenity=birthing_centre]`,
      `nwr${A}["healthcare:speciality"~"obstetric|gynaecology|midwifery"]`,
    ],
    maternity: [
      `nwr${A}[healthcare=birthing_centre]`,
      `nwr${A}["healthcare:speciality"~"obstetric|gynaecology"]`,
      `nwr${A}[amenity~"hospital|clinic"][name~"${MATERNAL_NAME}"]`,
      `nwr${A}[healthcare~"hospital|clinic|centre"][name~"${MATERNAL_NAME}"]`,
    ],
    lab: [`nwr${A}[healthcare=laboratory]`, `nwr${A}[amenity=laboratory]`],
  };
  if (type === "all") return Object.values(byType).flat();
  return byType[type];
}

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function classify(tags: Record<string, string>): Facility["category"] {
  const name = tags.name ?? "";
  const hc = tags.healthcare ?? "";
  const amenity = tags.amenity ?? "";
  const spec = tags["healthcare:speciality"] ?? "";
  if (hc === "midwife" || /midwi/i.test(name)) return "midwife";
  if (hc === "birthing_centre" || amenity === "birthing_centre" || /obstetric|gynae/.test(spec) || new RegExp(MATERNAL_NAME).test(name))
    return "maternity";
  if (amenity === "hospital" || hc === "hospital") return "hospital";
  if (amenity === "pharmacy" || hc === "pharmacy" || tags.shop === "chemist") return "pharmacy";
  if (hc === "laboratory" || amenity === "laboratory") return "lab";
  if (hc === "centre" || new RegExp(PHC_NAME).test(name)) return "phc";
  return "clinic";
}

function address(tags: Record<string, string>) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:suburb"] ?? tags["addr:neighbourhood"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
    tags["addr:state"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : (tags["addr:full"] ?? null);
}

/** Queries OpenStreetMap for facilities within radiusM of the point. Rejects if every mirror fails. */
export async function overpassSearch(type: FacilityType, lat: number, lng: number, radiusM: number) {
  const A = `(around:${radiusM},${lat},${lng})`;
  const query = `[out:json][timeout:20];(${selectors(type, A).join(";")};);out center tags 150;`;

  // Public Overpass mirrors are individually flaky; race them and take the first good answer.
  const ctrl = new AbortController();
  const attempt = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(10000)]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Overpass ${res.status} from ${url}`);
    const json = (await res.json()) as { elements: OsmElement[] };
    return toFacilities(json.elements, type, lat, lng);
  };
  try {
    return await Promise.any(OVERPASS_MIRRORS.map(attempt));
  } finally {
    ctrl.abort();
  }
}

function toFacilities(elements: OsmElement[], type: FacilityType, lat: number, lng: number): Facility[] {
  const seen = new Set<string>();
  const out: Facility[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    if (pLat == null || pLng == null) continue;
    const name = tags.name ?? tags["name:en"] ?? tags.operator;
    if (!name) continue;
    // Same facility is often mapped both as a building and a point.
    const dedupeKey = `${name.toLowerCase()}|${pLat.toFixed(3)}|${pLng.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let category = classify(tags);
    if (type !== "all" && type !== "clinic") category = type;
    out.push({
      id: `osm:${el.type}/${el.id}`,
      name,
      category,
      lat: pLat,
      lng: pLng,
      distanceM: Math.round(haversine(lat, lng, pLat, pLng)),
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      address: address(tags),
      openingHours: tags.opening_hours ?? null,
      emergency: tags.emergency === "yes",
      ownership: tags["operator:type"] === "government" || tags["operator:type"] === "public" ? "Public" : tags["operator:type"] === "private" ? "Private" : null,
      source: "osm",
    });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

const OSRM_PROFILE: Record<RouteMode, string> = {
  driving: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
};

export async function osrmRoute(
  mode: RouteMode,
  from: [number, number],
  to: [number, number],
): Promise<RouteResponse> {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const url = `${OSRM_PROFILE[mode]}/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Routing ${res.status}`);
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) throw new Error("No route found");
  return {
    distanceM: Math.round(route.distance),
    durationS: Math.round(route.duration),
    geometry: route.geometry,
    steps: route.legs[0].steps.map((s: { maneuver: { type: string; modifier?: string }; name: string; distance: number }) => ({
      type: s.maneuver.type,
      modifier: s.maneuver.modifier ?? null,
      name: s.name ?? "",
      distanceM: Math.round(s.distance),
    })),
  };
}

export type Place = { label: string; lat: number; lng: number; state: string | null; lga: string | null };

function placeFromNominatim(r: {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}): Place {
  const a = r.address ?? {};
  const area = a.suburb ?? a.neighbourhood ?? a.village ?? a.town ?? a.city_district ?? a.city ?? a.county;
  const state = a.state ?? null;
  return {
    label: [area, state].filter(Boolean).join(", ") || r.display_name.split(",").slice(0, 2).join(","),
    lat: Number(r.lat),
    lng: Number(r.lon),
    state,
    lga: a.county ?? a.city_district ?? null,
  };
}

export async function geocode(q: string): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", limit: "6", countrycodes: "ng" }).toString();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder ${res.status}`);
  return ((await res.json()) as Parameters<typeof placeFromNominatim>[0][]).map(placeFromNominatim);
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", addressdetails: "1", zoom: "14" }).toString();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.error) return null;
  return { ...placeFromNominatim(json), lat, lng };
}
