const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "12345678", "123456789", "1234567890",
  "qwertyui", "qwertyuiop", "11111111", "iloveyou", "welcome1", "letmein1", "admin123", "admin1234",
  "customer123", "agent1234", "zimbabwe1", "harare123", "vrcpower1", "vrcpower123",
]);

/** Returns a reason the password is not acceptable, or null if it is fine. */
export function passwordProblem(pw: string, phone?: string): string | null {
  if (pw.length < 8) return "Use 8+ characters with letters and numbers.";
  if (pw.length > 128) return "That password is too long (128 characters max).";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use 8+ characters with letters and numbers.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common. Pick something less guessable.";
  if (phone && pw.replace(/\D/g, "").includes(phone.slice(-8))) return "Don't use your phone number in your password.";
  return null;
}
