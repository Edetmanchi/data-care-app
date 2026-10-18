export const FACILITY_TYPES = ["all", "phc", "hospital", "maternity", "midwife", "pharmacy", "clinic", "lab"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const isFacilityType = (v: unknown): v is FacilityType =>
  typeof v === "string" && (FACILITY_TYPES as readonly string[]).includes(v);

export type Facility = {
  id: string;
  name: string;
  category: Exclude<FacilityType, "all">;
  lat: number;
  lng: number;
  distanceM: number;
  phone: string | null;
  address: string | null;
  openingHours: string | null;
  emergency: boolean;
  ownership: "Public" | "Private" | null;
  source: "grid3" | "osm";
};

export type SearchResponse = {
  searchId: string | null;
  radiusM: number;
  source: "live" | "cache" | "none";
  facilities: Facility[];
};

export type RouteMode = "driving" | "walking";

export type RouteStep = {
  type: string;
  modifier: string | null;
  name: string;
  distanceM: number;
};

export type RouteResponse = {
  distanceM: number;
  durationS: number;
  geometry: GeoJSON.LineString;
  steps: RouteStep[];
};

/** Accent colour per category, used for markers and badges. */
export const CATEGORY_COLOR: Record<Facility["category"], string> = {
  hospital: "#ff4d6d",
  maternity: "#ff8fb1",
  midwife: "#c77dff",
  phc: "#2ee6c9",
  clinic: "#4cc9f0",
  pharmacy: "#7bf1a8",
  lab: "#ffd166",
};
