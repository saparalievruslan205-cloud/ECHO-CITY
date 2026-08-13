import type { UserRole } from "./types";

export interface RequestUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

function decodeFullName(request: Request) {
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (!encoded || encoding !== "percent-encoded-utf-8") return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;

  const { getD1, getRuntimeEnv } = await import("./runtime");
  const db = await getD1();
  const existing = await db.prepare("SELECT id, email, display_name AS displayName, role FROM users WHERE id = ?").bind(id).first<RequestUser>();
  if (existing) return existing;

  const displayName = decodeFullName(request) ?? email.split("@")[0];
  const runtime = await getRuntimeEnv();
  const admins = (runtime.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const role: UserRole = admins.includes(email.toLowerCase()) ? "admin" : "resident";
  await db.prepare("INSERT INTO users (id, email, display_name, role) VALUES (?, ?, ?, ?)").bind(id, email, displayName, role).run();
  return { id, email, displayName, role };
}

export async function requireRequestUser(request: Request) {
  const user = await getRequestUser(request);
  if (!user) throw new Response(JSON.stringify({ error: "Требуется вход" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
  return user;
}

export async function requireRole(request: Request, allowed: UserRole[]) {
  const user = await requireRequestUser(request);
  if (!allowed.includes(user.role)) throw new Response(JSON.stringify({ error: "Недостаточно прав" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
  return user;
}

export function roleCanAccess(ownerId: string, user: RequestUser) {
  return ownerId === user.id || user.role === "analyst" || user.role === "admin";
}
