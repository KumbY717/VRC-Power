"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { MapPin, Minus, Plus } from "lucide-react";
import type { Map as MlMap } from "maplibre-gl";
import { MAX_BOUNDS, loadMapLibrary, themedStyle, watchTheme } from "@/lib/mapLoader";

const HARARE: [number, number] = [31.0522, -17.8292];

/**
 * Pick a spot by moving the map under a fixed pin. Works the same with a finger or a mouse, and the pin never
 * hides what is under it. `lat`/`lng` are null until a spot has been chosen.
 */
export default function LocationPicker({ lat, lng, onMove }: { lat: number | null; lng: number | null; onMove: (lat: number, lng: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const quiet = useRef(false); // true while we move the map ourselves, so that doesn't count as the admin choosing
  const onMoveRef = useRef(onMove);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const start = useRef({ lat, lng });

  useEffect(() => {
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    let alive = true;
    let map: MlMap | null = null;
    let stopTheme = () => {};
    (async () => {
      try {
        const [lib, style] = await Promise.all([loadMapLibrary(), themedStyle()]);
        if (!alive || !box.current) return;
        const s = start.current;
        map = new lib.Map({
          container: box.current,
          style,
          center: s.lat !== null && s.lng !== null ? [s.lng, s.lat] : HARARE,
          zoom: s.lat !== null ? 17 : 11,
          maxBounds: MAX_BOUNDS,
          minZoom: 5,
          maxZoom: 19,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          renderWorldCopies: false,
          fadeDuration: 0,
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;
        map.on("moveend", () => {
          if (quiet.current || !map) return;
          const c = map.getCenter();
          onMoveRef.current(c.lat, c.lng);
        });
        map.once("load", () => alive && setReady(true));
        stopTheme = watchTheme(() => {
          themedStyle()
            .then((st) => alive && map && map.setStyle(st))
            .catch(() => {});
        });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      stopTheme();
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  // typed or "use my location" coordinates move the map to match
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - lat) < 1e-6 && Math.abs(c.lng - lng) < 1e-6) return;
    quiet.current = true;
    map.jumpTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 17) });
    quiet.current = false;
  }, [lat, lng, ready]);

  if (failed) {
    return <p className="rounded-2xl border border-line bg-raised p-4 text-sm text-muted">The map couldn&apos;t load. Type the latitude and longitude below instead.</p>;
  }

  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border-2 border-line bg-[var(--map-bg)]">
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-lime drop-shadow">
        <MapPin size={40} fill="currentColor" strokeWidth={1.5} className="text-lime [&_circle]:fill-[var(--bg)]" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg ring-2 ring-lime" />
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 200 })} className="grid h-10 w-10 place-items-center border-b border-line hover:bg-raised">
          <Plus size={18} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 200 })} className="grid h-10 w-10 place-items-center hover:bg-raised">
          <Minus size={18} />
        </button>
      </div>
      <p className="absolute bottom-2 left-2 rounded-full bg-bg/80 px-2.5 py-1 text-[10px] text-muted">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> · OpenFreeMap
      </p>
    </div>
  );
}
