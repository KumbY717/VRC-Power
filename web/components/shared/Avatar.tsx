type Look = { bg: string; eyes: "dots" | "wink" | "lines"; mouth: "smile" | "open" | "flat" };

const SET: Look[] = [
  { bg: "#bdeb6c", eyes: "dots", mouth: "smile" },
  { bg: "#8cc4ff", eyes: "wink", mouth: "smile" },
  { bg: "#b7a0ff", eyes: "dots", mouth: "open" },
  { bg: "#ffe066", eyes: "lines", mouth: "flat" },
  { bg: "#ff9ec9", eyes: "wink", mouth: "open" },
  { bg: "#7fe3d4", eyes: "lines", mouth: "smile" },
];

export const AVATAR_COUNT = SET.length;

/** Flat cartoon avatars. `id` picks one of six. */
export default function Avatar({ id, size = 48, className }: { id: number; size?: number; className?: string }) {
  const a = SET[((id % SET.length) + SET.length) % SET.length];
  const ink = "#0b0d0a";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill={a.bg} />
      <path d="M26 3 L19 12 H24 L22 18 L30 8 H25 Z" fill={ink} opacity="0.8" />
      {a.eyes === "dots" && (
        <>
          <circle cx="17" cy="25" r="2.7" fill={ink} />
          <circle cx="31" cy="25" r="2.7" fill={ink} />
        </>
      )}
      {a.eyes === "wink" && (
        <>
          <circle cx="17" cy="25" r="2.7" fill={ink} />
          <path d="M28 25 Q31 22 34 25" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      )}
      {a.eyes === "lines" && (
        <path d="M14 25 H20 M28 25 H34" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      )}
      {a.mouth === "smile" && <path d="M17 33 Q24 40 31 33" stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      {a.mouth === "open" && <ellipse cx="24" cy="35" rx="4.2" ry="3.4" fill={ink} />}
      {a.mouth === "flat" && <path d="M19 35 H29" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
    </svg>
  );
}
