"use client";

import { cn } from "@/lib/cn";

export default function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors",
        checked ? "border-lime bg-lime" : "border-line bg-raised"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 h-6 w-6 rounded-full transition-transform",
          checked ? "translate-x-[1.625rem] bg-ink" : "translate-x-0.5 bg-muted"
        )}
      />
    </button>
  );
}
