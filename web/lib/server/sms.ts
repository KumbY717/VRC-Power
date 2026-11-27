// SMS sending. Development prints the message in the server terminal.
// Before launch, add a real provider here (the function signature stays the same).

const mode = () => process.env.SMS_MODE ?? "console";

/** True only in development: the code is shown in the terminal and on screen so you can test without a phone. */
export const smsConsoleMode = () => mode() === "console" && process.env.NODE_ENV !== "production";

export async function sendSms(to: string, text: string): Promise<void> {
  if (smsConsoleMode()) {
    console.log(`\n[SMS to ${to}] ${text}\n`);
    return;
  }
  // Never print codes in production. Until a provider exists, fail loudly instead of pretending.
  throw new Error("No SMS provider configured. Set one up in lib/server/sms.ts and set SMS_MODE.");
}
