import { json, route } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";

// "Who am I?" The browser asks this on load; the answer comes from the httpOnly cookie, not from anything the page stores.
// (It reads the request cookie, so Next always runs it live.)
export const GET = route(async (req) => {
  const s = await getSession(req);
  return json({ session: s ? s.user : null });
});
