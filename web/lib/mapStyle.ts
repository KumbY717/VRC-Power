// Re-colours a ready-made map style so the map matches the app (flat, olive, high contrast, light or dark).
// Pure function: takes a MapLibre style (JSON) and a palette, returns a new style. It never changes the original.

export type MapPalette = {
  bg: string; // ground
  block: string; // buildings and built-up areas
  road: string; // ordinary roads
  roadMajor: string; // main roads
  line: string; // paths, rail, borders
  park: string;
  water: string;
  text: string;
  halo: string; // outline behind text so it stays readable
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const GREEN = /park|wood|forest|grass|green|garden|cemetery|golf|pitch|recreation|nature|scrub|farm|meadow/;
const HIDE = /poi|housenumber|shield|aerialway|rail_station|transit|airport|mountain_peak|ferry/;
const MAJOR = /motorway|trunk|primary|major/;
const THIN = /rail|path|pedestrian|footway|cycle|track|steps|aeroway|runway|taxiway|boundary|admin/;

function recolor(layer: Json, p: MapPalette): Json {
  const l: Json = { ...layer, paint: { ...(layer.paint ?? {}) }, layout: { ...(layer.layout ?? {}) } };
  const key = `${layer.id ?? ""} ${layer["source-layer"] ?? ""}`.toLowerCase();

  switch (layer.type) {
    case "background":
      l.paint["background-color"] = p.bg;
      delete l.paint["background-pattern"];
      break;
    case "fill":
      delete l.paint["fill-pattern"];
      delete l.paint["fill-outline-color"];
      if (/water/.test(key)) l.paint["fill-color"] = p.water;
      else if (GREEN.test(key)) l.paint["fill-color"] = p.park;
      else if (/building/.test(key)) l.paint["fill-color"] = p.block;
      else {
        l.paint["fill-color"] = p.block;
        l.paint["fill-opacity"] = 0.55;
      }
      break;
    case "fill-extrusion":
      l.paint["fill-extrusion-color"] = p.block;
      break;
    case "line":
      delete l.paint["line-pattern"];
      delete l.paint["line-gradient"];
      if (/water/.test(key)) l.paint["line-color"] = p.water;
      else if (/casing|outline/.test(key)) l.paint["line-color"] = p.bg;
      else if (THIN.test(key)) l.paint["line-color"] = p.line;
      else if (MAJOR.test(key)) l.paint["line-color"] = p.roadMajor;
      else l.paint["line-color"] = p.road;
      break;
    case "symbol":
      if (HIDE.test(key)) {
        l.layout.visibility = "none"; // our station pins are the points of interest
      } else {
        l.paint["text-color"] = p.text;
        l.paint["text-halo-color"] = p.halo;
        l.paint["text-halo-width"] = 1.4;
        l.paint["text-halo-blur"] = 0;
        l.paint["icon-opacity"] = 0;
      }
      break;
  }
  return l;
}

export function themeStyle(style: Json, p: MapPalette): Json {
  const out: Json = { ...style };
  out.layers = ((style.layers as Json[]) ?? []).map((l) => recolor(l, p));
  return out;
}
