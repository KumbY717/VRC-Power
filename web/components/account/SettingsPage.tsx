"use client";

import { useState } from "react";
import SubPage from "@/components/shared/SubPage";
import Toggle from "@/components/shared/Toggle";
import { Lang, TextSize, Theme, useAccount } from "@/lib/account";
import { cn } from "@/lib/cn";
import { passwordScore } from "@/lib/validate";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl border border-line bg-surface p-4">
      <h3 className="font-heading text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-full bg-raised p-1 text-sm font-bold"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("rounded-full py-2.5", value === o.id ? "bg-lime text-ink" : "text-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="leading-tight">
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const METER = ["bg-line", "bg-bad", "bg-warn", "bg-sun", "bg-lime"];
const METER_LABEL = ["", "Weak", "Okay", "Good", "Strong"];

export default function SettingsPage({ onBack, onToast }: { onBack: () => void; onToast: (m: string) => void }) {
  const a = useAccount();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwError, setPwError] = useState("");
  const [del, setDel] = useState(false);
  const [delText, setDelText] = useState("");
  const score = passwordScore(pw);

  function changePassword() {
    if (!cur) return setPwError("Enter your current password.");
    if (pw.length < 8) return setPwError("Use at least 8 characters.");
    if (pw === cur) return setPwError("Choose a password different from the current one.");
    if (pw !== pw2) return setPwError("The new passwords don't match.");
    setPwError("");
    setCur("");
    setPw("");
    setPw2("");
    onToast("Password updated (demo)");
  }

  const field = "w-full rounded-2xl border border-line bg-raised px-4 py-3 text-base outline-none focus:border-lime";

  return (
    <SubPage title="Settings" onBack={onBack}>
      <Card title="Appearance">
        <Segmented<Theme>
          label="Theme"
          value={a.theme}
          onChange={(v) => a.set({ theme: v })}
          options={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }]}
        />
        <Row label="High contrast" hint="Stronger borders and brighter text">
          <Toggle checked={a.contrast} onChange={(v) => a.set({ contrast: v })} label="High contrast" />
        </Row>
        <div>
          <p className="mb-2 font-semibold">Text size</p>
          <Segmented<TextSize>
            label="Text size"
            value={a.textSize}
            onChange={(v) => a.set({ textSize: v })}
            options={[{ id: "normal", label: "Normal" }, { id: "large", label: "Large" }]}
          />
        </div>
      </Card>

      <Card title="Language">
        <Segmented<Lang>
          label="Language"
          value={a.lang}
          onChange={(v) => a.set({ lang: v })}
          options={[{ id: "en", label: "English" }, { id: "sn", label: "Shona" }, { id: "nd", label: "Ndebele" }]}
        />
        {a.lang !== "en" && <p className="text-sm text-muted">Shona and Ndebele translations are coming soon. Your choice is saved.</p>}
      </Card>

      <Card title="Notifications">
        <Row label="Rental reminders" hint="Before your 24 hours run out">
          <Toggle checked={a.notify.reminders} onChange={(v) => a.setNotify("reminders", v)} label="Rental reminders" />
        </Row>
        <Row label="Receipts" hint="After every rental or top-up">
          <Toggle checked={a.notify.receipts} onChange={(v) => a.setNotify("receipts", v)} label="Receipts" />
        </Row>
        <Row label="Offers and news">
          <Toggle checked={a.notify.promos} onChange={(v) => a.setNotify("promos", v)} label="Offers and news" />
        </Row>
      </Card>

      <Card title="Change password">
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" autoComplete="current-password" aria-label="Current password" className={field} />
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" aria-label="New password" className={field} />
        <div aria-hidden="true">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-2 flex-1 rounded-full", i <= score ? METER[score] : "bg-raised")} />
            ))}
          </div>
        </div>
        {score > 0 && <p className="text-sm text-muted">Strength: {METER_LABEL[score]}</p>}
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" aria-label="Repeat new password" className={field} />
        {pwError && <p className="text-sm font-semibold text-bad" role="alert">{pwError}</p>}
        <button onClick={changePassword} className="w-full rounded-full bg-lime py-3.5 font-bold text-ink">
          Update password
        </button>
      </Card>

      <Card title="About">
        <Row label="Terms of service"><button onClick={() => onToast("Terms page coming soon")} className="text-sm font-bold text-lime">View</button></Row>
        <Row label="Privacy policy"><button onClick={() => onToast("Privacy page coming soon")} className="text-sm font-bold text-lime">View</button></Row>
        <Row label="Version"><span className="text-sm text-muted">0.3 demo</span></Row>
      </Card>

      <section className="space-y-3 rounded-3xl border-2 border-bad p-4">
        <h3 className="font-heading text-lg font-bold text-bad">Danger zone</h3>
        <p className="text-sm text-muted">
          Deleting your account removes your profile. Unused cash top-ups can be refunded to the account they came from. Promo credits can&apos;t.
        </p>
        {!del ? (
          <button onClick={() => setDel(true)} className="w-full rounded-full border-2 border-bad py-3 font-bold text-bad">
            Delete account
          </button>
        ) : (
          <div className="space-y-2">
            <input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder='Type DELETE to confirm' aria-label="Type DELETE to confirm" className={field} />
            <div className="flex gap-2">
              <button onClick={() => { setDel(false); setDelText(""); }} className="flex-1 rounded-full border border-line py-3 font-bold">Cancel</button>
              <button
                disabled={delText !== "DELETE"}
                onClick={() => { setDel(false); setDelText(""); onToast("Demo only: nothing was deleted"); }}
                className="flex-1 rounded-full bg-bad py-3 font-bold text-ink disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </section>
    </SubPage>
  );
}
