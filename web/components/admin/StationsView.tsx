"use client";

import { useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import LocationPicker from "@/components/map/LocationPicker";
import { Card, Chip, ConfirmModal, Drawer, btnGhost, btnPrimary, fieldCls } from "./ui";
import { useAdmin } from "@/lib/admin";
import type { AdminStationDto } from "@/lib/appTypes";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime } from "@/lib/validate";

function Cabinet({ s, onToast, onEdit }: { s: AdminStationDto; onToast: (m: string) => void; onEdit: () => void }) {
  const { remoteUnlock, setStationStatus } = useAdmin();
  const [slot, setSlot] = useState<number | null>(null);
  const [ask, setAsk] = useState(false);
  const [askStatus, setAskStatus] = useState(false);
  const banks = s.slots.filter((x): x is { serial: string; charge: number } => x !== null);
  const ready = banks.filter((b) => b.charge >= 60).length;
  const avg = banks.length ? Math.round(banks.reduce((n, b) => n + b.charge, 0) / banks.length) : 0;
  const online = s.status === "online";

  return (
    <Card
      title={s.name}
      action={
        <Chip tone={online ? "ok" : "bad"}>
          <span className="relative mr-2 inline-block h-2 w-2 align-middle">
            {online && <span className="anim-pulse absolute inset-0 rounded-full bg-lime/60" />}
            <span className={cn("absolute inset-0 rounded-full", online ? "bg-lime" : "bg-bad")} />
          </span>
          {online ? "Online" : "Out of service"}
        </Chip>
      }
    >
      <p className="-mt-2 text-sm text-muted">{s.code} · {s.venue}</p>
      <p className="mb-4 mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <MapPin size={14} />
        {s.placed ? <span>{s.address || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}</span> : <Chip tone="warn">Position not set</Chip>}
        <button onClick={onEdit} className="font-bold text-lime underline">{s.placed ? "Edit" : "Set position"}</button>
      </p>

      <div className="mx-auto grid max-w-sm grid-cols-4 gap-2 rounded-3xl border-4 border-fg/60 bg-raised p-3" role="group" aria-label={`${s.name} slots`}>
        {s.slots.map((b, i) => (
          <button
            key={i}
            onClick={() => setSlot(i)}
            aria-pressed={slot === i}
            aria-label={`Slot ${i + 1}, ${b === null ? "empty" : `${b.charge}% charged`}`}
            className={cn("relative flex h-24 flex-col items-center justify-end overflow-hidden rounded-xl border-2 bg-bg", slot === i ? "border-lime" : "border-line")}
          >
            {b !== null && <span className={cn("absolute inset-x-0 bottom-0", b.charge >= 60 ? "bg-lime" : b.charge >= 40 ? "bg-sun" : "bg-warn")} style={{ height: `${b.charge}%` }} />}
            <span className={cn("relative mb-1 rounded bg-bg/80 px-1 text-[11px] font-bold", b === null && "text-muted")}>{i + 1}</span>
            <span className="relative mb-1.5 text-[11px] font-bold text-fg">{b === null ? "empty" : `${b.charge}%`}</span>
          </button>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Ready (60%+)</dt><dd className="text-right font-semibold">{ready}/{s.slots.length}</dd>
        <dt className="text-muted">Docked</dt><dd className="text-right font-semibold">{banks.length}</dd>
        <dt className="text-muted">Avg charge</dt><dd className="text-right font-semibold">{avg}%</dd>
        {slot !== null && s.slots[slot] && (
          <>
            <dt className="text-muted">Slot {slot + 1} power bank</dt><dd className="text-right font-mono text-xs">{s.slots[slot]?.serial}</dd>
          </>
        )}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button disabled={slot === null} onClick={() => setAsk(true)} className={cn(btnGhost, "disabled:opacity-40")}>
          {slot === null ? "Select a slot" : `Unlock slot ${slot + 1}`}
        </button>
        <button onClick={() => setAskStatus(true)} className={btnGhost}>{online ? "Take out of service" : "Put back in service"}</button>
      </div>

      {ask && slot !== null && (
        <ConfirmModal
          title={`Unlock slot ${slot + 1}?`}
          body="The station will be told to pop this slot open. Use this to help a customer or recover a stuck power bank. It is logged with your reason."
          confirmLabel="Send unlock"
          needReason
          onClose={() => setAsk(false)}
          onConfirm={async (reason) => {
            const res = await remoteUnlock(s.id, slot + 1, reason);
            if (!res.ok) return res.reason;
            onToast(`Unlock queued for ${s.name}, slot ${slot + 1}`);
          }}
        />
      )}
      {askStatus && (
        <ConfirmModal
          title={online ? `Take ${s.name} out of service?` : `Put ${s.name} back in service?`}
          body={online ? "Customers can't rent from it or return to it until you put it back. Rentals already out are not affected." : "Customers can rent from it and return to it again."}
          confirmLabel={online ? "Take out of service" : "Put back"}
          danger={online}
          needReason
          onClose={() => setAskStatus(false)}
          onConfirm={async (reason) => {
            const res = await setStationStatus(s.id, online ? "offline" : "online", reason);
            if (!res.ok) return res.reason;
            onToast(online ? "Station is out of service" : "Station is back in service");
          }}
        />
      )}
    </Card>
  );
}

const CMD_TONE = { queued: "warn", sent: "warn", done: "ok", failed: "bad" } as const;

/** Add a station, or change one's name and position. Move the map so the pin is on the spot. */
function StationForm({ station, onClose, onToast }: { station: AdminStationDto | null; onClose: () => void; onToast: (m: string) => void }) {
  const { saveStation } = useAdmin();
  const editing = station !== null;
  const [name, setName] = useState(station?.name ?? "");
  const [venue, setVenue] = useState(station?.venue ?? "");
  const [address, setAddress] = useState(station?.address ?? "");
  const [code, setCode] = useState("");
  const [slots, setSlots] = useState("8");
  const [latText, setLatText] = useState(station?.placed ? String(station.lat) : "");
  const [lngText, setLngText] = useState(station?.placed ? String(station.lng) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const lat = latText.trim() === "" ? NaN : Number(latText);
  const lng = lngText.trim() === "" ? NaN : Number(lngText);
  const have = Number.isFinite(lat) && Number.isFinite(lng);

  function useMyLocation() {
    if (!navigator.geolocation) return setError("This browser can't share its location.");
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setLatText(p.coords.latitude.toFixed(6));
        setLngText(p.coords.longitude.toFixed(6));
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Allow location for this site, or move the map instead.");
      },
      { enableHighAccuracy: true, timeout: 20_000 }
    );
  }

  async function submit() {
    if (busy) return;
    if (!have) return setError("Choose the position: move the map so the pin is on the station, or use your current location.");
    setBusy(true);
    setError("");
    const r = await saveStation({
      id: station?.id,
      code: editing ? undefined : code,
      name,
      venue,
      address,
      lat,
      lng,
      slotCount: editing ? undefined : Number(slots),
    });
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    onToast(editing ? "Station saved" : "Station added. It is out of service until you put it in service.");
    onClose();
  }

  return (
    <Drawer title={editing ? `Edit ${station.name}` : "Add a station"} onClose={onClose}>
      <label className="block text-sm font-bold">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Sam Levy Village Hub" className={cn(fieldCls, "mt-1.5 font-normal")} />
      </label>
      <label className="block text-sm font-bold">
        Venue
        <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} placeholder="e.g. Sam Levy's Village, Borrowdale" className={cn(fieldCls, "mt-1.5 font-normal")} />
      </label>
      <label className="block text-sm font-bold">
        Where exactly (optional)
        <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} placeholder="e.g. Ground floor, next to the ATM" className={cn(fieldCls, "mt-1.5 font-normal")} />
      </label>
      {!editing && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold">
            Station code
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={14} placeholder="VRC-HC03" className={cn(fieldCls, "mt-1.5 font-mono font-normal")} />
            <span className="mt-1 block text-xs font-normal text-muted">Printed on the station&apos;s sticker.</span>
          </label>
          <label className="block text-sm font-bold">
            Slots
            <input value={slots} onChange={(e) => setSlots(e.target.value)} inputMode="numeric" className={cn(fieldCls, "mt-1.5 font-normal")} />
            <span className="mt-1 block text-xs font-normal text-muted">Can&apos;t be changed later.</span>
          </label>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-bold">Position</p>
        <LocationPicker
          lat={have ? lat : null}
          lng={have ? lng : null}
          onMove={(a, b) => {
            setLatText(a.toFixed(6));
            setLngText(b.toFixed(6));
          }}
        />
        <p className="mt-2 text-xs text-muted">Move the map so the pin is exactly on the station. Zoom in for accuracy.</p>
        <button type="button" onClick={useMyLocation} disabled={locating} className={cn(btnGhost, "mt-3 flex items-center gap-2 disabled:opacity-60")}>
          <LocateFixed size={16} /> {locating ? "Finding you…" : "I'm at the station: use my location"}
        </button>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold">
            Latitude
            <input value={latText} onChange={(e) => setLatText(e.target.value)} inputMode="decimal" placeholder="-17.8292" className={cn(fieldCls, "mt-1 font-mono text-sm font-normal")} />
          </label>
          <label className="block text-xs font-bold">
            Longitude
            <input value={lngText} onChange={(e) => setLngText(e.target.value)} inputMode="decimal" placeholder="31.0522" className={cn(fieldCls, "mt-1 font-mono text-sm font-normal")} />
          </label>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
      <button onClick={submit} disabled={busy} className={cn(btnPrimary, "w-full")}>
        {busy ? "Saving…" : editing ? "Save station" : "Add station"}
      </button>
    </Drawer>
  );
}

export default function StationsView({ onToast }: { onToast: (m: string) => void }) {
  const { stations, commands } = useAdmin();
  const [form, setForm] = useState<{ station: AdminStationDto | null } | null>(null);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Customers see these on the map. A new station starts out of service until you put it in service.</p>
        <button onClick={() => setForm({ station: null })} className={btnPrimary}>Add station</button>
      </div>
      {stations.length === 0 && <Card><p className="text-sm text-muted">No stations yet.</p></Card>}
      <div className="grid gap-5 lg:grid-cols-2">
        {stations.map((s) => (
          <Cabinet key={s.id} s={s} onToast={onToast} onEdit={() => setForm({ station: s })} />
        ))}
      </div>
      {form && <StationForm key={form.station?.id ?? "new"} station={form.station} onClose={() => setForm(null)} onToast={onToast} />}
      <Card title="Unlock commands">
        {commands.length === 0 ? (
          <p className="text-sm text-muted">No commands sent yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {commands.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-raised p-3">
                <span>
                  <span className="font-bold">{c.station}</span> · slot {c.slot} <span className="text-muted">· {c.by} · {fmtDate(c.at)} {fmtTime(c.at)}</span>
                  <span className="block text-muted">{c.reason}</span>
                </span>
                <Chip tone={CMD_TONE[c.status as keyof typeof CMD_TONE] ?? "muted"}>{c.status}</Chip>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Commands wait as &ldquo;queued&rdquo; until the station server is connected (a later step). Live signal, firmware and heartbeat will appear here then.</p>
      </Card>
    </div>
  );
}
