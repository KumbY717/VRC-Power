"use client";

import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "@/lib/store";

/** The customer's personal QR. A VRC agent scans it to add cash top-ups. */
export default function QrSheet({ onClose }: { onClose: () => void }) {
  const { accountCode } = useApp();
  return (
    <div className="anim-fade fixed inset-0 z-[65] grid place-items-center bg-black/70 p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-label="My QR code"
        className="anim-sheet w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold">My QR code</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-raised text-muted"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-auto w-fit rounded-2xl bg-white p-4">
          <QRCodeSVG value={accountCode} size={220} level="M" bgColor="#ffffff" fgColor="#0b0d0a" />
        </div>
        <p className="mt-4 font-mono text-2xl font-bold tracking-widest">{accountCode}</p>
        <p className="mt-2 text-sm text-muted">
          Show this to a VRC agent when you pay cash. They scan it and your credits arrive instantly.
          Turn your screen brightness up so it scans quickly.
        </p>
      </div>
    </div>
  );
}
