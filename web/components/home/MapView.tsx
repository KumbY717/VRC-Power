"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, RefreshCw } from "lucide-react";
import type { Map as MlMap } from "maplibre-gl";
import NearbyList from "./NearbyList";
import { cn } from "@/lib/cn";
import { distanceM, metersPerPixel } from "@/lib/geo";
import { useLocation } from "@/lib/location";
import { MAX_BOUNDS, loadMapLibrary, themedStyle, watchTheme } from "@/lib/mapLoader";
import { Station, avgCharge, readyCount } from "@/lib/mock";

type Props = {
  stations: Station[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  insetTop: number;
  insetBottom: number;
};

const HIDDEN = "translate3d(-9999px, -9999px, 0)";
const HARARE: [number, number] = [31.0522, -17.8292];

function chipClass(s: Station) {
  if (s.status === "offline") return "bg-raised text-muted";
  return readyCount(s) > 0 ? "bg-lime text-ink" : "bg-warn text-ink";
}

export default function MapView({ stations, selectedId, onSelect, insetTop, insetBottom }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const pins = useRef(new Map<string, HTMLDivElement>());
  const userEl = useRef<HTMLDivElement | null>(null);
  const ringEl = useRef<HTMLSpanElement | null>(null);
  const wantCenter = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(12);
  const [tileProblem, setTileProblem] = useState(false);
  const { pos, state: locState, message: locMessage, locate } = useLocation();

  // the latest values, readable from map event handlers without re-creating the map
  const latest = useRef({ stations, pos, insetTop, insetBottom });
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    latest.current = { stations, pos, insetTop, insetBottom };
    onSelectRef.current = onSelect;
  });

  /** Moves every pin (and the "you are here" dot) to where the map currently shows it. */
  const place = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { stations: list, pos: me } = latest.current;
    for (const s of list) {
      const el = pins.current.get(s.id);
      if (!el) continue;
      const p = map.project([s.lng, s.lat]);
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    }
    const u = userEl.current;
    if (u) {
      if (me) {
        const p = map.project([me.lng, me.lat]);
        u.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        const ring = ringEl.current;
        if (ring) {
          const d = Math.max(22, Math.min(600, (2 * me.accuracy) / metersPerPixel(me.lat, map.getZoom())));
          ring.style.width = ring.style.height = `${d}px`;
          ring.style.left = ring.style.top = `${-d / 2}px`;
        }
      } else u.style.transform = HIDDEN;
    }
  }, []);

  // create the map
  useEffect(() => {
    let alive = true;
    let map: MlMap | null = null;
    let loaded = false;
    let stopTheme = () => {};
    const giveUp = setTimeout(() => {
      if (alive && !loaded) setStatus("failed"); // very slow or blocked network: show the list instead
    }, 25_000);
    setStatus("loading");

    (async () => {
      try {
        const [lib, style] = await Promise.all([loadMapLibrary(), themedStyle()]);
        if (!alive || !box.current) return;
        map = new lib.Map({
          container: box.current,
          style,
          center: HARARE,
          zoom: 11,
          maxBounds: MAX_BOUNDS,
          minZoom: 5,
          maxZoom: 18,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          renderWorldCopies: false,
          fadeDuration: 0, // no fading labels: calm
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;
        map.on("move", place);
        map.on("resize", place);
        map.on("zoomend", () => setZoom(map ? map.getZoom() : 12));
        map.on("click", () => onSelectRef.current(null));
        map.on("error", (e) => {
          console.warn("[map]", e?.error?.message ?? e);
          if (alive) setTileProblem(true);
        });
        map.on("data", (e) => {
          if (alive && e?.dataType === "source" && e?.isSourceLoaded) setTileProblem(false);
        });
        map.once("load", () => {
          if (!alive || !map) return;
          loaded = true;
          map.resize();
          fitInitial(map, latest.current);
          setStatus("ready");
          place();
        });
        stopTheme = watchTheme(() => {
          themedStyle()
            .then((s) => alive && map && map.setStyle(s))
            .catch(() => {});
        });
      } catch (e) {
        console.warn("[map] could not start", e);
        if (alive) setStatus("failed");
      }
    })();

    return () => {
      alive = false;
      clearTimeout(giveUp);
      stopTheme();
      mapRef.current = null;
      map?.remove();
    };
  }, [attempt, place]);

  // keep pins and the position dot in step with the data
  useEffect(() => {
    place();
  }, [stations, pos, status, zoom, place]);

  // selecting a station brings it into the visible part of the map
  useEffect(() => {
    const map = mapRef.current;
    const sel = stations.find((s) => s.id === selectedId);
    if (!map || status !== "ready" || !sel) return;
    map.easeTo({
      center: [sel.lng, sel.lat],
      zoom: Math.max(map.getZoom(), 14),
      padding: { top: insetTop, bottom: insetBottom, left: 0, right: 0 },
      duration: 350,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, status]);

  // after a tap on "locate me", centre on the first position that arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!pos || !wantCenter.current || !map || status !== "ready") return;
    wantCenter.current = false;
    map.easeTo({
      center: [pos.lng, pos.lat],
      zoom: Math.max(map.getZoom(), 15),
      padding: { top: insetTop, bottom: insetBottom, left: 0, right: 0 },
      duration: 350,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, status]);

  function onLocate() {
    wantCenter.current = true;
    locate();
    const map = mapRef.current;
    if (pos && map) {
      wantCenter.current = false;
      map.easeTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), 15), padding: { top: insetTop, bottom: insetBottom, left: 0, right: 0 }, duration: 350 });
    }
  }

  const compact = zoom < 12.5;

  if (status === "failed") {
    return (
      <div className="absolute inset-0 overflow-y-auto bg-[var(--map-bg)] px-4" style={{ paddingTop: insetTop + 8, paddingBottom: 120 }}>
        <div className="mx-auto max-w-md space-y-3">
          <div className="rounded-3xl border border-line bg-surface p-4 text-sm">
            <p className="font-bold">The map couldn&apos;t load</p>
            <p className="mt-1 text-muted">Check your connection. You can still pick a station from the list below.</p>
            <button onClick={() => setAttempt((n) => n + 1)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2.5 text-sm font-bold text-ink">
              <RefreshCw size={16} /> Try again
            </button>
          </div>
          <NearbyList stations={stations} selectedId={selectedId} onSelect={(id) => onSelect(id)} />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--map-bg)]">
      {/* inline style on purpose: MapLibre's stylesheet would otherwise override Tailwind's "absolute" and collapse the map to nothing */}
      <div ref={box} style={{ position: "absolute", inset: 0 }} />

      {status === "loading" && <p className="absolute inset-x-0 top-1/2 text-center text-sm font-semibold text-muted">Loading map…</p>}

      {/* station pins and the "you are here" dot sit on top of the map and follow it */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: status === "ready" ? 1 : 0 }}>
        {pos && (
          <div ref={userEl} className="absolute left-0 top-0" style={{ transform: HIDDEN, zIndex: 2 }}>
            <span ref={ringEl} className="absolute rounded-full border border-sky/50 bg-sky/15" />
            <span className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border-2 border-white bg-sky" />
          </div>
        )}

        {stations.map((s) => {
          const selected = s.id === selectedId;
          const live = s.status === "online";
          return (
            <div
              key={s.id}
              ref={(el) => {
                if (el) pins.current.set(s.id, el);
                else pins.current.delete(s.id);
              }}
              className="absolute left-0 top-0"
              style={{ transform: HIDDEN, zIndex: selected ? 5 : 3 }}
            >
              <button
                data-pin
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(s.id);
                }}
                className={cn(
                  "pointer-events-auto absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center",
                  selected && "scale-110"
                )}
                aria-label={`${s.name}, ${readyCount(s)} of ${s.slots.length} power banks ready`}
              >
                <span
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full border bg-surface py-1 pl-1 text-[13px] font-semibold shadow-card",
                    compact && !selected ? "pr-1" : "pr-3",
                    selected ? "border-lime ring-2 ring-lime/40" : "border-line"
                  )}
                >
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", chipClass(s))}>
                    {live ? `${readyCount(s)}/${s.slots.length}` : "Off"}
                  </span>
                  {(!compact || selected) && <span className="max-w-[9.5rem] truncate">{s.name}</span>}
                </span>
                <span className="relative mt-1.5 h-3 w-3">
                  <span className={cn("absolute inset-0 rounded-full border-2 border-bg", live ? "bg-lime" : "bg-muted")} />
                </span>
                {live && !compact && (
                  <span className="absolute top-full mt-1 rounded-full bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    {avgCharge(s)}%
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* map credits (required by the data licence) */}
      <p className="absolute left-4 z-10 rounded-full bg-bg/80 px-2.5 py-1 text-[10px] text-muted md:left-[var(--edge)]" style={{ top: insetTop }}>
        <span className="hidden sm:inline">
          <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="underline">OpenFreeMap</a>{" "}
          © <a href="https://openmaptiles.org" target="_blank" rel="noopener noreferrer" className="underline">OpenMapTiles</a> · Data{" "}
        </span>
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>
      </p>

      {/* zoom and locate */}
      {tileProblem && (
        <p className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-card" style={{ top: insetTop + 36 }} role="status">
          Some of the map is slow to load. Check your connection.
        </p>
      )}

      <div className="map-controls absolute right-4 z-10 flex flex-col items-end gap-2 md:right-[var(--edge)]" style={{ bottom: insetBottom }}>
        {locMessage && (locState === "denied" || locState === "unavailable") && (
          <p className="max-w-[16rem] rounded-2xl border border-line bg-surface p-3 text-xs text-muted shadow-card" role="status">{locMessage}</p>
        )}
        <div className="hidden flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:flex">
          <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 200 })} className="grid h-11 w-11 place-items-center border-b border-line hover:bg-raised">
            <Plus size={20} />
          </button>
          <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 200 })} className="grid h-11 w-11 place-items-center hover:bg-raised">
            <Minus size={20} />
          </button>
        </div>
        <button
          aria-label="Show my location"
          onClick={onLocate}
          className={cn("grid h-12 w-12 place-items-center rounded-full border shadow-card", locState === "on" ? "border-lime bg-lime text-ink" : "border-line bg-surface")}
        >
          <LocateFixed size={22} />
        </button>
      </div>
    </div>
  );
}

/** First view: all stations in frame (and the customer too, if they are within about 40 km of one). */
function fitInitial(map: MlMap, v: { stations: Station[]; pos: { lat: number; lng: number } | null; insetTop: number; insetBottom: number }) {
  const h = map.getContainer().clientHeight;
  const padTop = Math.min(v.insetTop + 30, h * 0.4);
  const padBottom = Math.min(v.insetBottom + 30, h * 0.4);
  const pts: { lat: number; lng: number }[] = v.stations.map((s) => ({ lat: s.lat, lng: s.lng }));
  if (v.pos && pts.some((p) => distanceM(p, v.pos!) < 40_000)) pts.push(v.pos);
  if (!pts.length) {
    map.jumpTo({ center: HARARE, zoom: 11 });
    return;
  }
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
  map.fitBounds(bounds, { padding: { top: padTop, bottom: padBottom, left: 40, right: 40 }, maxZoom: 15, duration: 0 });
}
