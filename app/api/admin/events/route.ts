import { requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getD1, writeAudit } from "@/lib/runtime";
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(3).max(1000),
  category: z.enum(["transport", "ecology", "safety", "energy", "event"]),
  severity: z.enum(["info", "warning", "critical"]),
  coordinates: z.tuple([z.number().min(74.45).max(74.72), z.number().min(42.78).max(42.95)]),
  districtId: z.enum(["leninskiy", "oktyabrskiy", "pervomayskiy", "sverdlovskiy"]),
  sourceUrl: z.string().url(),
  startsAt: z.string().datetime(),
});

export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const db = await getD1();
    const result = await db.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT 100").all();
    return Response.json({ events: result.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const payload = eventSchema.parse(await request.json());
    const db = await getD1();
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO events (id, title, description, category, severity, longitude, latitude, district_id, source_url, source_type, starts_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'observed', ?, 'published')").bind(
      id, payload.title, payload.description, payload.category, payload.severity,
      String(payload.coordinates[0]), String(payload.coordinates[1]), payload.districtId,
      payload.sourceUrl, payload.startsAt,
    ).run();
    await writeAudit({ actorId: actor.id, action: "event.create", entityType: "event", entityId: id, after: payload });
    return Response.json({ event: { id, ...payload, status: "published", sourceType: "observed" } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const payload = z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(await request.json());
    const db = await getD1();
    const before = await db.prepare("SELECT id, status FROM events WHERE id = ?").bind(payload.id).first();
    if (!before) return Response.json({ error: "Событие не найдено" }, { status: 404 });
    await db.prepare("UPDATE events SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payload.status, payload.id).run();
    await writeAudit({ actorId: actor.id, action: "event.status.update", entityType: "event", entityId: payload.id, before, after: payload });
    return Response.json({ event: { ...before, status: payload.status } });
  } catch (error) {
    return jsonError(error);
  }
}

