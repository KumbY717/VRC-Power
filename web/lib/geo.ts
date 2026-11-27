// Map maths and rules shared by the app and the server. Pure functions, no browser or database needed.

export type LatLng = { lat: number; lng: number };

/** Stations created before real positions existed sit here (central Harare). It means "position not set yet". */
export const PLACEHOLDER: LatLng = { lat: -17.8292, lng: 31.0522 };

/** A box around Zimbabwe, used to catch typing mistakes such as swapped or missing minus signs. */
export const ZIMBABWE = { south: -22.5, north: -15.5, west: 25.1, east: 33.1 };

export const isPlaceholder = (p: LatLng) => p.lat === PLACEHOLDER.lat && p.lng === PLACEHOLDER.lng;

/** Plain-words problem with a position, or null if it is fine. */
export function positionProblem(lat: unknown, lng: unknown): string | null {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "Choose the station's position on the map, or type its latitude and longitude.";
  }
  if (lat < ZIMBABWE.south || lat > ZIMBABWE.north || lng < ZIMBABWE.west || lng > ZIMBABWE.east) {
    return "That position isn't in Zimbabwe. Check the numbers (latitude is about -17, longitude about 31).";
  }
  return null;
}

const R = 6_371_008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line distance in metres between two points (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "320 m", "1.4 km", "12 km". Rounded so it doesn't pretend to be more exact than a phone's GPS. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

/** About 80 metres a minute on foot. */
export const walkMinutes = (m: number) => Math.max(1, Math.round(m / 80));

/** Opens turn-by-turn directions in whatever maps app the phone prefers. */
export function directionsUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}&travelmode=walking`;
}

/** How many metres one screen pixel covers at this latitude and zoom (512px tiles, as MapLibre uses). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (78271.517 * Math.cos(rad(lat))) / 2 ** zoom;
}
