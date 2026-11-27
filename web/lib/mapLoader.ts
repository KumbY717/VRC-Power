"use client";

// Loads the map library and the map's look. Used by the customer map and the admin position picker.
// The map tiles come from OpenFreeMap (free, built on OpenStreetMap data, no account or key). The ready-made
// "positron" style is fetched once and re-coloured with the app's own colours (see mapStyle.ts).

import type { MapPalette } from "./mapStyle";
import { themeStyle } from "./mapStyle";

export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export type MapLib = typeof import("maplibre-gl");

let lib: Promise<MapLib> | null = null;

/**
 * Loads MapLibre. Under Next.js MapLibre can't find its own background worker file, so we tell it where it is
 * (this is the setup MapLibre documents for Next.js 15+ with Turbopack).
 */
export function loadMapLibrary(): Promise<MapLib> {
  if (!lib) {
    lib = (async () => {
      const m = (await import("maplibre-gl")) as unknown as MapLib & { default?: MapLib };
      const ml = (m.Map ? m : m.default) as MapLib & { setWorkerUrl?: (url: string) => void };
      ml.setWorkerUrl?.(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      return ml;
    })().catch((e) => {
      lib = null; // try again next time
      throw e;
    });
  }
  return lib;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let raw: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fetchStyle(): Promise<any> {
  if (!raw) {
    raw = fetch(STYLE_URL, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`style ${r.status}`);
        return r.json();
      })
      .catch((e) => {
        raw = null; // try again next time
        throw e;
      });
  }
  return raw;
}

const FALLBACK: MapPalette = {
  bg: "#0d100c",
  block: "#222820",
  road: "#454e40",
  roadMajor: "#7a8774",
  line: "#7a8774",
  park: "#24481f",
  water: "#123a52",
  text: "#96a38e",
  halo: "#0d100c",
};

/** The app's current map colours (they differ in light and dark mode), read from the CSS variables. */
export function readPalette(): MapPalette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--map-bg", FALLBACK.bg),
    block: v("--map-block", FALLBACK.block),
    road: v("--map-road", FALLBACK.road),
    roadMajor: v("--map-line", FALLBACK.roadMajor),
    line: v("--map-line", FALLBACK.line),
    park: v("--map-park", FALLBACK.park),
    water: v("--map-water", FALLBACK.water),
    text: v("--map-text", FALLBACK.text),
    halo: v("--map-bg", FALLBACK.halo),
  };
}

/** The style to give the map right now. Throws if the style can't be downloaded. */
export async function themedStyle() {
  return themeStyle(await fetchStyle(), readPalette());
}

/** Calls `fn` when the app switches between light and dark. Returns a function that stops listening. */
export function watchTheme(fn: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", fn);
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  return () => {
    mq.removeEventListener("change", fn);
    mo.disconnect();
  };
}

/** The Zimbabwe-wide area the map may show (keeps people from scrolling off to the other side of the world). */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [24, -24],
  [34.5, -14],
];
