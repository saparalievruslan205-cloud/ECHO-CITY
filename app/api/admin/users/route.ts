import { requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getD1, writeAudit } from "@/lib/runtime";
import { z } from "zod";

const updateSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["resident", "analyst", "admin"]),
});

export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const db = await getD1();
    const result = await db.prepare("SELECT id, email, display_name AS displayName, role, created_at AS createdAt, updated_at AS updatedAt FROM users ORDER BY created_at DESC LIMIT 100").all();
    return Response.json({ users: result.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const payload = updateSchema.parse(await request.json());
    const db = await getD1();
    const before = await db.prepare("SELECT id, email, role FROM users WHERE id = ?").bind(payload.id).first();
    if (!before) return Response.json({ error: "Пользователь не найден" }, { status: 404 });
    await db.prepare("UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payload.role, payload.id).run();
    await writeAudit({ actorId: actor.id, action: "user.role.update", entityType: "user", entityId: payload.id, before, after: { ...before, role: payload.role } });
    return Response.json({ user: { ...before, role: payload.role } });
  } catch (error) {
    return jsonError(error);
  }
}

