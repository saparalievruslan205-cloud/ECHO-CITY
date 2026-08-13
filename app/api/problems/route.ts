import { requireRequestUser, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { problemSchema } from "@/lib/simulation";
import { getD1, writeAudit } from "@/lib/runtime";
import { z } from "zod";

interface ProblemRow {
  id: string;
  ownerId: string;
  type: string;
  longitude: string | number;
  latitude: string | number;
  intensity: number;
  radius: number;
  durationMinutes: number;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const db = await getD1();
    const canModerate = user.role === "admin";
    const statement = db.prepare(
      `SELECT id, owner_id AS ownerId, type, longitude, latitude, intensity, radius, duration_minutes AS durationMinutes, description, status, created_at AS createdAt, updated_at AS updatedAt FROM problems ${canModerate ? "" : "WHERE owner_id = ?"} ORDER BY created_at DESC LIMIT 100`,
    );
    const result = canModerate ? await statement.all<ProblemRow>() : await statement.bind(user.id).all<ProblemRow>();
    return Response.json({ problems: result.results.map((row) => ({
      ...row,
      coordinates: [Number(row.longitude), Number(row.latitude)],
    })) });
  } catch (error) {
    return jsonError(error);
  }
}

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

export async function PATCH(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const payload = z.object({ id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected"]) }).parse(await request.json());
    const db = await getD1();
    const before = await db.prepare("SELECT id, owner_id AS ownerId, status FROM problems WHERE id = ?").bind(payload.id).first();
    if (!before) return Response.json({ error: "Проблема не найдена" }, { status: 404 });
    await db.prepare("UPDATE problems SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payload.status, payload.id).run();
    await writeAudit({ actorId: actor.id, action: "problem.status.update", entityType: "problem", entityId: payload.id, before, after: { ...before, status: payload.status } });
    return Response.json({ problem: { ...before, status: payload.status } });
  } catch (error) {
    return jsonError(error);
  }
}
