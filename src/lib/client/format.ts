export function formatDistance(m: number) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDuration(s: number, minLabel: string) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} ${minLabel}`;
  return `${Math.floor(min / 60)} h ${min % 60} ${minLabel}`;
}

export function googleMapsUrl(from: [number, number] | null, to: [number, number], mode: "driving" | "walking") {
  const p = new URLSearchParams({ api: "1", destination: `${to[0]},${to[1]}`, travelmode: mode });
  if (from) p.set("origin", `${from[0]},${from[1]}`);
  return `https://www.google.com/maps/dir/?${p}`;
}
