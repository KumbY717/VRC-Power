import { cn } from "@/lib/cn";

/** "Volty", the flat power-bank mascot. Static on purpose (calm UI). */
export default function Mascot({
  size = 48,
  mood = "happy",
  className,
}: {
  size?: number;
  mood?: "happy" | "sleepy";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect x="25" y="3" width="14" height="8" rx="3" fill="#8fbf45" />
      <rect x="9" y="30" width="7" height="14" rx="3.5" fill="#8fbf45" />
      <rect x="48" y="30" width="7" height="14" rx="3.5" fill="#8fbf45" />
      <rect x="14" y="8" width="36" height="50" rx="12" fill="#bdeb6c" />
      <rect x="14" y="8" width="36" height="50" rx="12" fill="none" stroke="#0f1410" strokeOpacity="0.25" strokeWidth="2" />
      {mood === "happy" ? (
        <>
          <circle cx="26" cy="25" r="3.4" fill="#0f1410" />
          <circle cx="38" cy="25" r="3.4" fill="#0f1410" />
          <circle cx="27.2" cy="23.8" r="1.1" fill="#fff" />
          <circle cx="39.2" cy="23.8" r="1.1" fill="#fff" />
          <path d="M27 32 Q32 37 37 32" stroke="#0f1410" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M23 25 H29 M35 25 H41" stroke="#0f1410" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="32" cy="34" r="2" fill="#0f1410" />
        </>
      )}
      <path d="M34 39 L27 48 H32 L30 55 L38 45 H33 Z" fill="#0f1410" />
    </svg>
  );
}
