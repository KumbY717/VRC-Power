"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { passwordScore } from "@/lib/validate";

const METER = ["bg-line", "bg-bad", "bg-warn", "bg-sun", "bg-lime"];
const WORDS = ["", "Weak", "Okay", "Good", "Strong"];

export const inputCls =
  "w-full rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-base outline-none transition-colors focus:border-lime";

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  meter = false,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  meter?: boolean;
  error?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const score = passwordScore(value);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          className={cn(inputCls, "pr-14", error && "border-bad")}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {meter && value && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-2 flex-1 rounded-full", i <= score ? METER[score] : "bg-raised")} />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Strength: {WORDS[score]}</p>
        </div>
      )}
      {error && (
        <p className="mt-1.5 text-sm font-semibold text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
