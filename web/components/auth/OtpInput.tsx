"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/** Six digit boxes. Supports typing, backspace, arrow keys, paste and SMS autofill. */
export default function OtpInput({
  value,
  onChange,
  error = false,
  disabled = false,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
  length?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  function handleChange(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (d.length > 1) {
      const next = (value.slice(0, i) + d).slice(0, length);
      onChange(next);
      focus(next.length);
    } else if (d.length === 1) {
      const arr = [...digits];
      arr[i] = d;
      onChange(arr.join("").slice(0, length));
      focus(i + 1);
    } else {
      const arr = [...digits];
      arr[i] = "";
      onChange(arr.join(""));
    }
  }

  return (
    <div
      className="flex justify-center gap-2"
      role="group"
      aria-label="Verification code"
      onPaste={(e) => {
        e.preventDefault();
        const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        onChange(d);
        focus(d.length);
      }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d) focus(i - 1);
            if (e.key === "ArrowLeft") focus(i - 1);
            if (e.key === "ArrowRight") focus(i + 1);
          }}
          className={cn(
            "h-14 w-11 rounded-2xl border-2 bg-surface text-center font-heading text-2xl font-bold outline-none transition-colors sm:w-12",
            error ? "border-bad" : d ? "border-lime" : "border-line focus:border-lime",
            disabled && "opacity-50"
          )}
        />
      ))}
    </div>
  );
}
