"use client";

import { useState } from "react";
import Avatar, { AVATAR_COUNT } from "@/components/shared/Avatar";
import SubPage from "@/components/shared/SubPage";
import { useAccount } from "@/lib/account";
import { cn } from "@/lib/cn";
import { isEmail, isZwMobile } from "@/lib/validate";

export default function ProfilePage({ onBack, onToast }: { onBack: () => void; onToast: (m: string) => void }) {
  const { profile, updateProfile } = useAccount();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter your name.";
    if (!isZwMobile(phone)) e.phone = "Enter a Zimbabwe mobile number, e.g. 077 123 4567.";
    if (email.trim() && !isEmail(email)) e.email = "That email doesn't look right.";
    setErrors(e);
    if (Object.keys(e).length) return;
    updateProfile({ name: name.trim(), phone: phone.trim(), email: email.trim(), avatar });
    onToast("Profile saved");
    onBack();
  }

  const field = "mt-1.5 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-lime";

  return (
    <SubPage title="Edit profile" onBack={onBack}>
      <div className="flex justify-center py-2">
        <Avatar id={avatar} size={96} />
      </div>
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Choose an avatar">
        {Array.from({ length: AVATAR_COUNT }, (_, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={avatar === i}
            aria-label={`Avatar ${i + 1}`}
            onClick={() => setAvatar(i)}
            className={cn("grid place-items-center rounded-full p-1", avatar === i ? "ring-4 ring-lime" : "ring-1 ring-line")}
          >
            <Avatar id={i} size={44} />
          </button>
        ))}
      </div>

      <label className="block text-sm font-semibold">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
        {errors.name && <span className="mt-1 block text-sm text-bad">{errors.name}</span>}
      </label>
      <label className="block text-sm font-semibold">
        Phone number
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={field} autoComplete="tel" />
        {errors.phone && <span className="mt-1 block text-sm text-bad">{errors.phone}</span>}
      </label>
      <label className="block text-sm font-semibold">
        Email <span className="font-normal text-muted">(optional)</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={field} autoComplete="email" />
        {errors.email && <span className="mt-1 block text-sm text-bad">{errors.email}</span>}
      </label>
      <button onClick={save} className="w-full rounded-full bg-lime py-4 text-base font-bold text-ink">
        Save changes
      </button>
    </SubPage>
  );
}
