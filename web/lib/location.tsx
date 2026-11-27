"use client";

// The phone's position. It is never sent to our server: distances are worked out on the phone.
// The browser only asks for permission when the customer taps "locate me" (or if they already allowed it earlier).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { distanceM } from "./geo";
import type { LatLng } from "./geo";

export type Fix = LatLng & { accuracy: number };
export type LocationState = "off" | "asking" | "on" | "denied" | "unavailable";

type Ctx = { pos: Fix | null; state: LocationState; message: string; locate: () => void };

const LocationContext = createContext<Ctx | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [pos, setPos] = useState<Fix | null>(null);
  const [state, setState] = useState<LocationState>("off");
  const [message, setMessage] = useState("");
  const watch = useRef<number | null>(null);

  const start = useCallback(() => {
    if (watch.current !== null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      setMessage("This phone or browser can't share its location.");
      return;
    }
    setState((s) => (s === "on" ? s : "asking"));
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const next: Fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setPos((prev) => (prev && distanceM(prev, next) < 15 && next.accuracy >= prev.accuracy * 0.8 ? prev : next)); // ignore tiny jitter
        setState("on");
        setMessage("");
      },
      (err) => {
        if (err.code === 1) {
          setState("denied");
          setMessage("Location is blocked. Allow it for this site in your browser settings, then tap again.");
          if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
          watch.current = null;
        } else {
          setState((s) => (s === "on" ? s : "unavailable"));
          setMessage("Can't find your location right now. Try again outside or with GPS on.");
        }
      },
      { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 }
    );
  }, []);

  // if they already said yes on an earlier visit, just continue quietly
  useEffect(() => {
    let alive = true;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((r) => {
        if (alive && r.state === "granted") start();
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (watch.current !== null && typeof navigator !== "undefined") navigator.geolocation?.clearWatch(watch.current);
      watch.current = null;
    };
  }, [start]);

  const value = useMemo<Ctx>(() => ({ pos, state, message, locate: start }), [pos, state, message, start]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): Ctx {
  const c = useContext(LocationContext);
  if (!c) throw new Error("useLocation must be used inside LocationProvider");
  return c;
}
