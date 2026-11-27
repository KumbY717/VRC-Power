"use client";

import { ArrowLeft } from "lucide-react";

/** Full-screen page with a back button. Used for everything opened from Account. */
export default function SubPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="anim-fade fixed inset-0 z-[55] flex flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={onBack}
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-heading text-2xl font-bold">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto max-w-xl space-y-4">{children}</div>
      </div>
    </div>
  );
}
