import { formatDistance } from "@/lib/geo";
import { Station, avgCharge, readyCount } from "@/lib/mock";
import { cn } from "@/lib/cn";

export default function NearbyList({
  stations,
  selectedId,
  onSelect,
}: {
  stations: Station[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // nearest first when this phone's position is known, otherwise by name
  const sorted = [...stations].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || a.name.localeCompare(b.name));
  if (!sorted.length) {
    return <p className="py-6 text-center text-sm text-muted">No stations match your search.</p>;
  }
  return (
    <ul className="space-y-2">
      {sorted.map((s) => {
        const live = s.status === "online";
        const r = readyCount(s);
        return (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl border bg-raised px-4 py-3 text-left transition-colors hover:border-lime/60",
                s.id === selectedId ? "border-lime" : "border-transparent"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                <span className="block text-xs text-muted">
                  {s.distanceM !== null && `${formatDistance(s.distanceM)} · `}
                  {live ? `${avgCharge(s)}% avg. charge` : "Offline"}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                  !live ? "bg-bg text-muted" : r > 0 ? "bg-lime/20 text-lime" : "bg-warn/20 text-warn"
                )}
              >
                {live ? `${r}/${s.slots.length}` : "Off"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
