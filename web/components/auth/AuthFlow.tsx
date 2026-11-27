"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/shared/Logo";
import Mascot from "@/components/shared/Mascot";
import { useAccount } from "@/lib/account";
import { callApi } from "@/lib/api";
import { DEMO_ACCOUNTS, Role, SHOW_DEMO, Session, useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { isEmail, isZwMobile, maskNumber, passwordScore } from "@/lib/validate";
import OtpInput from "./OtpInput";
import PasswordField, { inputCls } from "./PasswordField";

type View = "login" | "signup" | "otp" | "forgot" | "reset" | "reset-done" | "apply" | "apply-done";
// challengeId is the secret handle for the SMS code check. devCode only exists in development.
type Pending =
  | { kind: "signup"; id: string; name: string; email: string; password: string; challengeId: string; devCode?: string }
  | { kind: "reset"; id: string; challengeId: string; devCode?: string };

function useCountdown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  return {
    left: Math.max(0, Math.ceil((until - now) / 1000)),
    start: (seconds: number) => {
      setNow(Date.now());
      setUntil(Date.now() + seconds * 1000);
    },
  };
}

function Frame({
  title,
  subtitle,
  onBack,
  mood = "happy",
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  mood?: "happy" | "sleepy";
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            aria-label="Back"
            className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface"
          >
            <ArrowLeft size={20} />
          </button>
          <Logo />
          <span className="w-11" />
        </div>
        <div className="mt-7 flex flex-col items-center text-center">
          <Mascot size={72} mood={mood} />
          <h1 className="mt-3 font-heading text-3xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 max-w-sm text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="mt-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, error, optional, children }: { label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      <span className="mt-1.5 block">{children}</span>
      {error && (
        <span className="mt-1.5 block text-sm font-semibold text-bad" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

const primary =
  "w-full rounded-full bg-lime py-4 text-base font-bold text-ink hover:brightness-105 disabled:bg-raised disabled:text-muted";
const linkBtn = "font-bold text-lime underline-offset-4 hover:underline";

/* ---------------------------------------------------------------- login */
function LoginView({
  go,
  onAuthed,
  onBack,
}: {
  go: (v: View) => void;
  onAuthed: (s: Session) => void;
  onBack: () => void;
}) {
  const auth = useAuth();
  const [role, setRole] = useState<Role>("customer");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [errors, setErrors] = useState<{ id?: string; pw?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const lock = useCountdown();

  const isAdmin = role === "admin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.left > 0 || busy) return;
    const errs: typeof errors = {};
    if (isAdmin ? !isEmail(id) : !isZwMobile(id)) errs.id = isAdmin ? "Enter your email address." : "Enter a Zimbabwe mobile number, e.g. 077 123 4567.";
    if (!pw) errs.pw = "Enter your password.";
    setErrors(errs);
    if (errs.id || errs.pw) return;
    setBusy(true);
    const r = await auth.login(role, id, pw);
    setBusy(false);
    if (r.ok) return onAuthed(r.session);
    // the server uses one message for every kind of failure, and counts attempts itself
    if (r.reason === "locked") lock.start(r.retryAfter ?? 60);
    setErrors({ form: r.reason === "locked" ? "" : r.message });
  }

  return (
    <Frame
      title="Welcome back"
      subtitle="Log in to find a power bank near you."
      onBack={onBack}
      mood={errors.form ? "sleepy" : "happy"}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div role="radiogroup" aria-label="I am a" className="grid grid-cols-3 gap-1 rounded-full bg-raised p-1 text-sm font-bold">
          {(["customer", "agent", "admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => {
                setRole(r);
                setId("");
                setErrors({});
              }}
              className={cn("rounded-full py-2.5 capitalize", role === r ? "bg-lime text-ink" : "text-muted")}
            >
              {r}
            </button>
          ))}
        </div>

        <Field label={isAdmin ? "Email" : "Phone number"} error={errors.id}>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            inputMode={isAdmin ? "email" : "tel"}
            autoComplete={isAdmin ? "email" : "tel"}
            placeholder={isAdmin ? "you@example.com" : "077 123 4567"}
            className={cn(inputCls, errors.id && "border-bad")}
          />
        </Field>
        <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="current-password" error={errors.pw} />

        {errors.form && lock.left === 0 && (
          <p className="rounded-2xl bg-bad/15 p-3 text-sm font-semibold text-bad" role="alert">
            {errors.form}
          </p>
        )}
        {lock.left > 0 && (
          <p className="rounded-2xl bg-warn/15 p-3 text-sm font-semibold text-warn" role="alert">
            Too many attempts. Try again in {lock.left}s.
          </p>
        )}

        <button type="submit" disabled={busy || lock.left > 0} className={primary}>
          {busy ? "Checking…" : "Log in"}
        </button>
        {role !== "admin" && (
          <p className="text-center text-sm">
            <button type="button" onClick={() => go("forgot")} className={linkBtn}>
              Forgot password?
            </button>
          </p>
        )}
      </form>

      {role === "customer" && (
        <p className="text-center text-sm text-muted">
          New here?{" "}
          <button onClick={() => go("signup")} className={linkBtn}>
            Create an account
          </button>
        </p>
      )}

      {SHOW_DEMO && (
        <div className="rounded-3xl border border-dashed border-line p-4 text-sm">
          <button onClick={() => setDemo((d) => !d)} aria-expanded={demo} className="font-bold text-muted">
            Demo accounts {demo ? "▲" : "▼"}
          </button>
          {demo && (
            <ul className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.role} className="rounded-2xl bg-raised p-3">
                  <p className="font-bold capitalize">{a.role}</p>
                  <p className="font-mono text-xs text-muted">{a.id} · {a.pw}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Frame>
  );
}

/* ---------------------------------------------------------------- signup */
function SignupView({
  onBack,
  onSubmit,
  onLogin,
}: {
  onBack: () => void;
  onSubmit: (p: { name: string; phone: string; email: string; password: string }) => Promise<string | null>;
  onLogin: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    if (name.trim().length < 2) er.name = "Enter your name.";
    if (!isZwMobile(phone)) er.phone = "Enter a Zimbabwe mobile number, e.g. 077 123 4567.";
    if (email.trim() && !isEmail(email)) er.email = "That email doesn't look right.";
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw) || passwordScore(pw) < 2)
      er.pw = "Use 8+ characters with letters and numbers.";
    if (pw !== pw2) er.pw2 = "The passwords don't match.";
    if (!terms) er.terms = "Please accept the terms to continue.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const problem = await onSubmit({ name: name.trim(), phone, email: email.trim(), password: pw });
    setBusy(false);
    if (problem) setErrors({ form: problem });
  }

  return (
    <Frame title="Create your account" subtitle="Takes a minute. We'll text you a code to confirm your number." onBack={onBack}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={cn(inputCls, errors.name && "border-bad")} />
        </Field>
        <Field label="Phone number" error={errors.phone}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="077 123 4567" className={cn(inputCls, errors.phone && "border-bad")} />
        </Field>
        <Field label="Email" optional error={errors.email}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" className={cn(inputCls, errors.email && "border-bad")} />
        </Field>
        <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="new-password" meter error={errors.pw} />
        <PasswordField label="Repeat password" value={pw2} onChange={setPw2} autoComplete="new-password" error={errors.pw2} />
        <div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--lime)]" />
            <span>
              I agree to the Terms of Service and Privacy Policy, and understand credits can only be used on VRC Power services.
            </span>
          </label>
          {errors.terms && <p className="mt-1.5 text-sm font-semibold text-bad" role="alert">{errors.terms}</p>}
        </div>
        {errors.form && (
          <p className="rounded-2xl bg-bad/15 p-3 text-sm font-semibold text-bad" role="alert">
            {errors.form}
          </p>
        )}
        <button type="submit" disabled={busy} className={primary}>{busy ? "Sending code…" : "Continue"}</button>
      </form>
      <p className="text-center text-sm text-muted">
        Already have an account? <button onClick={onLogin} className={linkBtn}>Log in</button>
      </p>
    </Frame>
  );
}

/* ---------------------------------------------------------------- otp */
function OtpView({
  pending,
  onBack,
  onVerify,
  onResend,
}: {
  pending: Pending;
  onBack: () => void;
  onVerify: (code: string) => Promise<{ ok: true } | { ok: false; message: string; triesLeft?: number; fatal?: boolean }>;
  onResend: () => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dead, setDead] = useState(false); // too many wrong tries or expired: needs a new code
  const resend = useCountdown();

  useEffect(() => {
    resend.start(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify() {
    if (code.length < 6 || dead || busy) return;
    setBusy(true);
    const r = await onVerify(code);
    setBusy(false);
    if (r.ok) return;
    setCode("");
    setError(r.triesLeft !== undefined && r.triesLeft > 0 ? `${r.message} ${r.triesLeft} ${r.triesLeft === 1 ? "try" : "tries"} left.` : r.message);
    if (r.fatal || r.triesLeft === 0) setDead(true);
  }

  async function sendNew() {
    resend.start(30);
    const problem = await onResend();
    setCode("");
    setDead(false);
    setError(problem ?? "");
  }

  return (
    <Frame
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${maskNumber(pending.id)}.`}
      onBack={onBack}
      mood={error ? "sleepy" : "happy"}
    >
      <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); }} error={!!error} disabled={dead || busy} />
      {error && <p className="text-center text-sm font-semibold text-bad" role="alert">{error}</p>}
      <button onClick={verify} disabled={code.length < 6 || dead || busy} className={primary}>
        {busy ? "Verifying…" : "Verify"}
      </button>
      <p className="text-center text-sm text-muted">
        {resend.left > 0 ? (
          `Send a new code in ${resend.left}s`
        ) : (
          <button onClick={sendNew} className={linkBtn}>
            Send a new code
          </button>
        )}
      </p>
      {pending.devCode && (
        <p className="rounded-2xl border border-dashed border-line p-3 text-center text-xs text-muted">
          Development mode: your code is <span className="font-mono font-bold text-fg">{pending.devCode}</span>
        </p>
      )}
    </Frame>
  );
}

/* ---------------------------------------------------------------- forgot / reset */
function ForgotView({ onBack, onSubmit }: { onBack: () => void; onSubmit: (phone: string) => Promise<string | null> }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isZwMobile(phone)) return setError("Enter a Zimbabwe mobile number, e.g. 077 123 4567.");
    setBusy(true);
    const problem = await onSubmit(phone);
    setBusy(false);
    if (problem) setError(problem);
  }
  return (
    <Frame title="Forgot password?" subtitle="Enter your phone number. If there's an account, we'll text you a code." onBack={onBack}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Phone number" error={error}>
          <input value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} inputMode="tel" autoComplete="tel" placeholder="077 123 4567" className={cn(inputCls, error && "border-bad")} />
        </Field>
        <button type="submit" disabled={busy} className={primary}>{busy ? "Sending…" : "Send code"}</button>
      </form>
    </Frame>
  );
}

function ResetView({ onBack, onDone }: { onBack: () => void; onDone: (pw: string) => Promise<string | null> }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw) || passwordScore(pw) < 2) er.pw = "Use 8+ characters with letters and numbers.";
    if (pw !== pw2) er.pw2 = "The passwords don't match.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const problem = await onDone(pw);
    setBusy(false);
    if (problem) setErrors({ pw: problem });
  }
  return (
    <Frame title="New password" subtitle="Choose something you don't use anywhere else." onBack={onBack}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField label="New password" value={pw} onChange={setPw} autoComplete="new-password" meter error={errors.pw} />
        <PasswordField label="Repeat new password" value={pw2} onChange={setPw2} autoComplete="new-password" error={errors.pw2} />
        <button type="submit" disabled={busy} className={primary}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </Frame>
  );
}

/* ---------------------------------------------------------------- done screens */
function DoneView({ title, text, action, onAction, onBack }: { title: string; text: string; action: string; onAction: () => void; onBack: () => void }) {
  return (
    <Frame title={title} subtitle={text} onBack={onBack}>
      <button onClick={onAction} className={primary}>{action}</button>
    </Frame>
  );
}

/* ---------------------------------------------------------------- agent application */
function ApplyView({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    if (name.trim().length < 2) er.name = "Enter your name.";
    if (!isZwMobile(phone)) er.phone = "Enter a Zimbabwe mobile number.";
    if (area.trim().length < 2) er.area = "Tell us where you'd like to work.";
    if (Object.keys(er).length) return setErrors(er);
    setBusy(true);
    const r = await callApi("/api/agent-applications", { name: name.trim(), phone, area: area.trim(), note: note.trim() });
    setBusy(false);
    if (r.ok) onSent();
    else setErrors({ form: r.message });
  }
  return (
    <Frame title="Become a VRC agent" subtitle="Help people power up at events and earn a daily allowance plus commission." onBack={onBack}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={cn(inputCls, errors.name && "border-bad")} />
        </Field>
        <Field label="Phone number" error={errors.phone}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className={cn(inputCls, errors.phone && "border-bad")} />
        </Field>
        <Field label="Where would you like to work?" error={errors.area}>
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Harare events, Borrowdale" className={cn(inputCls, errors.area && "border-bad")} />
        </Field>
        <Field label="Anything else we should know?" optional>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls} />
        </Field>
        {errors.form && (
          <p className="rounded-2xl bg-bad/15 p-3 text-sm font-semibold text-bad" role="alert">
            {errors.form}
          </p>
        )}
        <button type="submit" disabled={busy} className={primary}>{busy ? "Sending…" : "Send application"}</button>
      </form>
      <p className="text-center text-xs text-muted">Agent accounts are set up by our team after we speak with you.</p>
    </Frame>
  );
}

/* ---------------------------------------------------------------- flow */
export default function AuthFlow({
  start,
  onExit,
  onAuthed,
}: {
  start: "login" | "signup" | "apply";
  onExit: () => void;
  onAuthed: () => void;
}) {
  const auth = useAuth();
  const account = useAccount();
  const [view, setView] = useState<View>(start);
  const [pending, setPending] = useState<Pending | null>(null);

  /** Signed in: copy who they are into this device's profile screen, then let the app take over. */
  function finish(session: Session) {
    account.updateProfile({ name: session.name, phone: session.phone ?? "", email: session.email ?? "" });
    auth.adopt(session);
    onAuthed();
  }

  if (view === "login") return <LoginView go={setView} onAuthed={finish} onBack={onExit} />;

  if (view === "signup")
    return (
      <SignupView
        onBack={onExit}
        onLogin={() => setView("login")}
        onSubmit={async (p) => {
          const r = await auth.startSignup(p);
          if (!r.ok) return r.message;
          setPending({ kind: "signup", id: p.phone, name: p.name, email: p.email, password: p.password, challengeId: r.challengeId, devCode: r.devCode });
          setView("otp");
          return null;
        }}
      />
    );

  if (view === "otp" && pending)
    return (
      <OtpView
        pending={pending}
        onBack={() => setView(pending.kind === "signup" ? "signup" : "forgot")}
        onVerify={async (code) => {
          const r = await auth.verifyOtp(pending.challengeId, code);
          if (!r.ok) return { ok: false, message: r.message, triesLeft: r.triesLeft, fatal: r.code === "expired" || r.code === "too_many" };
          if (pending.kind === "signup") {
            if (r.session) finish(r.session);
          } else setView("reset");
          return { ok: true };
        }}
        onResend={async () => {
          const r = pending.kind === "signup"
            ? await auth.startSignup({ name: pending.name, phone: pending.id, email: pending.email, password: pending.password })
            : await auth.startReset(pending.id);
          if (!r.ok) return r.message;
          setPending({ ...pending, challengeId: r.challengeId, devCode: r.devCode });
          return null;
        }}
      />
    );

  if (view === "forgot")
    return (
      <ForgotView
        onBack={() => setView("login")}
        onSubmit={async (phone) => {
          const r = await auth.startReset(phone);
          if (!r.ok) return r.message;
          setPending({ kind: "reset", id: phone, challengeId: r.challengeId, devCode: r.devCode });
          setView("otp");
          return null;
        }}
      />
    );

  if (view === "reset" && pending?.kind === "reset")
    return (
      <ResetView
        onBack={() => setView("login")}
        onDone={async (pw) => {
          const r = await auth.resetPassword(pending.challengeId, pw);
          if (!r.ok) return r.message;
          setView("reset-done");
          return null;
        }}
      />
    );

  if (view === "reset-done")
    return (
      <DoneView
        title="Password updated"
        text="You can log in with your new password now."
        action="Back to log in"
        onAction={() => setView("login")}
        onBack={() => setView("login")}
      />
    );

  if (view === "apply") return <ApplyView onBack={onExit} onSent={() => setView("apply-done")} />;

  if (view === "apply-done")
    return (
      <DoneView
        title="Thanks! We'll be in touch"
        text="Our team will call you to talk about working events as a VRC agent."
        action="Back to home"
        onAction={onExit}
        onBack={onExit}
      />
    );

  return null;
}
