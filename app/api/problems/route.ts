import { requireRequestUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { problemSchema } from "@/lib/simulation";
import { getD1, writeAudit } from "@/lib/runtime";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const payload = problemSchema.parse(await request.json());
    const db = await getD1();
    const rate = await db.prepare(
      "SELECT COUNT(*) AS count FROM problems WHERE owner_id = ? AND created_at >= datetime('now', '-1 hour')",
    ).bind(user.id).first<{ count: number }>();
    if (Number(rate?.count ?? 0) >= 5) {
      return Response.json({ error: "Лимит: не более пяти проблем в час" }, { status: 429 });
    }

    const id = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO problems (id, owner_id, type, longitude, latitude, intensity, radius, duration_minutes, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
    ).bind(
      id,
      user.id,
      payload.type,
      String(payload.coordinates[0]),
      String(payload.coordinates[1]),
      payload.intensity,
      payload.radius,
      payload.durationMinutes,
      payload.description,
    ).run();
    await writeAudit({ actorId: user.id, action: "problem.create", entityType: "problem", entityId: id, after: payload });
    return Response.json({ problem: { id, ownerId: user.id, ...payload, status: "pending" } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

