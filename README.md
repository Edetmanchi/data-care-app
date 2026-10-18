# Datacare Care

Find the nearest hospital, primary health centre, maternity home, midwife or pharmacy in Nigeria and get directions without creating an account.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, MapLibre GL and Neon PostgreSQL.

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate              # creates the tables and reporting views in Neon
npm run dev                     # http://localhost:3000
```

The app still runs without `DATABASE_URL`: search and directions work, but nothing is recorded and accounts are disabled. This is deliberate, because a database outage should never stop someone from reaching care.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `AUTH_SECRET` | 32+ character secret that signs login cookies (required in production) |
| `STATS_TOKEN` | Bearer token for `GET /api/stats` |
| `OSM_CONTACT_EMAIL` | Contact sent to OpenStreetMap services, as their usage policy requires |

## User flow

1. **Open the app.** The browser asks for location permission. The last known location shows immediately while the live position is detected.
2. **Pick a location.** Use the detected one or enter a town, street or LGA by hand (Nigeria-only geocoding).
3. **Search.** Choose a facility type from the search bar or the quick chips, then tap *Find care near me*.
4. **Results.** A list sits next to a dark map with numbered, colour-coded markers. On mobile the list becomes a bottom sheet.
5. **Directions.** Selecting a card or marker draws the route and tilts the map into a navigation view. The panel shows the ETA, distance, turn-by-turn steps, *Open in Google Maps* and *Call*. Drive and walk modes are available.
6. **Sign-up prompt.** About 3 minutes after directions are first shown, anonymous users see one dismissible sign-up prompt per session.
7. **Live tracking.** This requires an account. Anonymous users who tap it get the sign-in sheet, and tracking starts automatically once they sign in.

The emergency **112** button is always in the navbar.

## Facility data

| Source | Role |
| --- | --- |
| **GRID3 Nigeria Health Facilities v2** (built from the National Health Facility Registry) | Main source. It covers about 51k facilities across all 36 states and the FCT, including rural PHCs and maternity homes, and responds in about 1.5 s. The search widens from 3 km to 10, 30 and then 80 km until at least 5 results are found. |
| **OpenStreetMap / Overpass** | Runs alongside GRID3. It adds pharmacies and midwives (which the registry barely covers), phone numbers and opening hours. Duplicates are merged with registry entries. Several mirrors are tried at once and the first answer wins. |
| **Neon `facilities` table** | Every facility returned is cached. If both live sources fail, results come from this cache and are marked as saved data. |

GRID3 v3 has richer facility types, but as of October 2026 it covers only 24 states and leaves out Lagos, so the app uses v2.

Routing uses OSRM (`routing.openstreetmap.de`), geocoding uses Nominatim, and map tiles come from CARTO Dark Matter, re-tinted to the brand palette. No API keys are needed.

## What is recorded (Neon)

All activity is recorded for both anonymous and signed-in users. Each browser gets an anonymous visitor ID cookie (`dc_vid`), which is linked to the account when the person signs up or logs in.

| Table | Contents |
| --- | --- |
| `visitors` | One row per browser: first and last seen, visit count, language, linked user |
| `users` | Accounts (phone or email, bcrypt password hash, preferred language) |
| `location_detections` | Every GPS, manual or live-tracking fix, plus failures such as permission denied or timeouts |
| `facility_searches` | Type, area, radius, result count, data source, response time, language |
| `direction_requests` | Each time directions are shown: facility, mode, distance, ETA, success |
| `facilities` | Cache of every facility returned |
| `events` | Page views, language changes, calls to facilities, Google Maps opens, sign-up prompt shown or dismissed, live tracking on or off |

Coordinates are rounded to about 100 m before they are stored.

The reporting views are `v_impact_totals`, `v_daily_usage`, `v_searches_by_type` (including searches that found nothing, which point to gaps in coverage) and `v_language_usage`. `GET /api/stats` with `Authorization: Bearer $STATS_TOKEN` returns all four as JSON.

## Languages

The app supports English (the default), Hausa, Yorùbá, Igbo, Nigerian Pidgin (Naijá) and Efik. The choice persists in the browser and is saved on the user's profile after sign-up. When Hausa, Yoruba, Igbo or Efik is selected, the UI switches to Noto Sans so that letters like ƙ, ẹ and ọ and the tone marks render correctly.

> **Before launch:** every non-English string in `src/lib/i18n.ts` must be reviewed by native-speaking health communicators. Efik has the lowest confidence. Any missing key falls back to English.

The PRD lists Urhobo as the fifth language and flags it as an open question. Pidgin is used here instead because it is the most widely understood language across Nigeria. To add Urhobo, add a dictionary and an entry in `LANGUAGES` in `src/lib/i18n.ts`.

## Production notes

- **Public service limits.** OSRM demo routing, Nominatim (about 1 request per second) and the Overpass mirrors are shared, best-effort services. At real traffic, self-host OSRM and Nominatim or switch to paid providers. Also check CARTO's basemap terms for your usage volume.
- **NDPA 2023.** Location and health-seeking behaviour count as sensitive personal data. Do a legal review of consent and retention before launch.
- **Map worker.** `scripts/copy-map-worker.mjs` copies MapLibre's web worker into `public/` before `dev` and `build`, because webpack cannot resolve it on its own.

## Project layout

```
db/schema.sql                    Neon schema + reporting views
src/app/page.tsx                 Landing page
src/app/search/page.tsx          Results, map, directions, live tracking
src/app/api/*                    facilities · directions · location · track · auth · stats
src/lib/server/search.ts         GRID3 + OSM orchestration and merging
src/lib/i18n.ts                  All UI strings, 6 languages
src/components/map/FacilityMap   MapLibre map, markers, animated route
```
# data-care-app
