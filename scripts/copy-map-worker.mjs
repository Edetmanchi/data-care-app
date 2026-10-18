// MapLibre v6 loads its web worker from a sibling file next to its own module URL. Webpack rewrites
// that URL, so we serve the (self-contained) worker from /public and point MapLibre at it.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.mjs"));
console.log("Copied maplibre-gl-worker.mjs → public/");
