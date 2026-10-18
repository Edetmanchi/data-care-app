"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, LngLatLike, Map as MLMap } from "maplibre-gl";

export type Pad = { top: number; bottom: number; left: number; right: number };
import { CATEGORY_COLOR, type Facility } from "@/lib/facility-types";

// Served from /public (see scripts/copy-map-worker.mjs).
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export type FacilityMapProps = {
  origin: { lat: number; lng: number };
  facilities: Facility[];
  selectedId: string | null;
  route: GeoJSON.LineString | null;
  padding: Pad;
  follow: boolean;
  onSelect: (id: string) => void;
};

/** Re-tints the CARTO dark basemap into the Datacare palette: near-black land, teal arteries. */
function tint(map: MLMap) {
  const set = (id: string, prop: string, value: unknown) => {
    try {
      map.setPaintProperty(id, prop as never, value as never);
    } catch {}
  };
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    if (layer.type === "background") set(id, "background-color", "#020507");
    else if (layer.type === "fill") {
      if (/water/.test(id)) set(id, "fill-color", "#03161b");
      else if (/building/.test(id)) set(id, "fill-color", "#09161b");
      else set(id, "fill-color", "#040c10");
    } else if (layer.type === "line") {
      if (/water|river|stream/.test(id)) set(id, "line-color", "#06303a");
      else if (/boundary|admin/.test(id)) set(id, "line-color", "#1f5a54");
      else if (/motorway|trunk|primary|major/.test(id)) set(id, "line-color", "#145550");
      else if (/road|street|highway|bridge|tunnel|path|rail/.test(id)) set(id, "line-color", "#0d2a2f");
    } else if (layer.type === "symbol") {
      set(id, "text-color", "#6d948f");
      set(id, "text-halo-color", "#020507");
    }
  }
}

/** Shifts a centred point into the part of the map not covered by the floating panel. */
const offsetFor = (p: Pad): [number, number] => [(p.left - p.right) / 2, (p.top - p.bottom) / 2];

function markerEl(f: Facility, index: number) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "dc-marker";
  el.style.setProperty("--c", CATEGORY_COLOR[f.category]);
  el.setAttribute("aria-label", f.name);
  el.innerHTML = `<span class="ring"></span><span class="core"><span>${index + 1}</span></span>`;
  return el;
}

function userEl() {
  const el = document.createElement("div");
  el.className = "dc-user";
  el.innerHTML = `<span class="wave"></span><span class="wave"></span><span class="dot"></span>`;
  return el;
}

export default function FacilityMap({ origin, facilities, selectedId, route, padding, follow, onSelect }: FacilityMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>());
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const paddingRef = useRef(padding);
  paddingRef.current = padding;
  const [ready, setReady] = useState(false);

  // Init once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: STYLE_URL,
      center: [origin.lng, origin.lat],
      zoom: 13,
      attributionControl: { compact: true },
      fadeDuration: 0,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    let raf = 0;
    map.on("load", () => {
      tint(map);
      map.addSource("route", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2ee6c9", "line-width": 14, "line-opacity": 0.22, "line-blur": 8 },
      });
      map.addLayer({
        id: "route-core",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2ee6c9", "line-width": 4.5 },
      });
      map.addLayer({
        id: "route-flow",
        type: "line",
        source: "route",
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": "#eafffb", "line-width": 2, "line-dasharray": [0, 4, 3] },
      });

      // Light pulses travelling along the route toward the facility.
      const seq = [
        [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
        [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
      ];
      let step = -1;
      let last = 0;
      const animate = (t: number) => {
        if (t - last > 60) {
          last = t;
          step = (step + 1) % seq.length;
          try {
            map.setPaintProperty("route-flow", "line-dasharray", seq[step]);
          } catch {}
        }
        raf = requestAnimationFrame(animate);
      };
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(animate);
      setReady(true);
    });

    const markerMap = markers.current;
    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      // Markers belong to the removed map; the next map instance must create its own.
      userMarker.current = null;
      markerMap.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User position beacon.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ll: LngLatLike = [origin.lng, origin.lat];
    if (!userMarker.current) userMarker.current = new maplibregl.Marker({ element: userEl() }).setLngLat(ll).addTo(map);
    else userMarker.current.setLngLat(ll);
    if (follow) map.easeTo({ center: ll, duration: 800, offset: offsetFor(paddingRef.current) });
  }, [origin.lat, origin.lng, follow]);

  // Facility markers + frame the nearest results.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const { marker } of markers.current.values()) marker.remove();
    markers.current.clear();

    facilities.forEach((f, i) => {
      const el = markerEl(f, i);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(f.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([f.lng, f.lat]).addTo(map);
      markers.current.set(f.id, { marker, el });
    });

    if (facilities.length) {
      const b = new maplibregl.LngLatBounds([origin.lng, origin.lat], [origin.lng, origin.lat]);
      facilities.slice(0, 8).forEach((f) => b.extend([f.lng, f.lat]));
      map.fitBounds(b, { padding: paddingRef.current, maxZoom: 15.5, duration: 1400 });
    } else {
      map.easeTo({ center: [origin.lng, origin.lat], zoom: 13, duration: 1000, offset: offsetFor(paddingRef.current) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities]);

  // Highlight the selected marker, dim the rest.
  useEffect(() => {
    for (const [id, { el }] of markers.current) {
      el.classList.toggle("is-selected", id === selectedId);
      el.classList.toggle("is-dimmed", selectedId !== null && id !== selectedId);
    }
    if (selectedId && !route) {
      const f = facilities.find((x) => x.id === selectedId);
      if (f) mapRef.current?.flyTo({ center: [f.lng, f.lat], zoom: 15, offset: offsetFor(paddingRef.current), duration: 1100 });
    }
  }, [selectedId, facilities, route]);

  // Tilts the camera into a navigation view framing the whole route.
  const fitRoute = useCallback((route: GeoJSON.LineString, duration: number) => {
    const map = mapRef.current;
    if (!map || route.coordinates.length < 2) return;
    const coords = route.coordinates as [number, number][];
    const b = coords.reduce((acc, c) => acc.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    const [sx, sy] = coords[0];
    const [ex, ey] = coords[coords.length - 1];
    const bearing = (Math.atan2(ex - sx, ey - sy) * 180) / Math.PI;
    const p = paddingRef.current;
    // Fit with the tilt applied, so the whole route stays in view of the navigation camera.
    map.fitBounds(b, {
      padding: { top: p.top + 40, bottom: p.bottom + 30, left: p.left + 30, right: p.right + 30 },
      bearing,
      pitch: 45,
      maxZoom: 16.5,
      duration,
      essential: true,
    });
  }, []);

  // Route: draw it, then frame it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("route") as GeoJSONSource | undefined;
    src?.setData(route ? { type: "Feature", properties: {}, geometry: route } : EMPTY);

    if (route) {
      fitRoute(route, 1900);
    } else if (!selectedId) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, ready]);

  // The floating panel changes size as it animates between views; re-frame once it settles.
  useEffect(() => {
    if (!route) return;
    const id = setTimeout(() => fitRoute(route, 700), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padding.top, padding.bottom, padding.left, padding.right]);

  // MapLibre forces `position: relative` on its container, so size it from an absolutely positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
