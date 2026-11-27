"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#bdeb6c", "#7fb8ff", "#a78bfa", "#ffd84d", "#ff7a6b"];

/** One-time burst. Put inside a `relative` parent. Skipped when reduced motion is on. */
export default function Confetti() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anims: Animation[] = [];
    const count = 22;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.style.cssText = `position:absolute;left:50%;top:32%;width:8px;height:12px;border-radius:2px;background:${COLORS[i % COLORS.length]}`;
      root.appendChild(el);
      const angle = (Math.PI * 2 * i) / count;
      const dist = 90 + Math.random() * 120;
      anims.push(
        el.animate(
          [
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            {
              transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 70}px) rotate(${Math.random() * 540}deg)`,
              opacity: 0,
            },
          ],
          { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" }
        )
      );
    }
    return () => {
      anims.forEach((a) => a.cancel());
      root.innerHTML = "";
    };
  }, []);

  return <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />;
}
