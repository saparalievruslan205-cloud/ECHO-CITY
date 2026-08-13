import { requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getD1, writeAudit } from "@/lib/runtime";
import { z } from "zod";

const metricSchema = z.object({
  districtId: z.enum(["leninskiy", "oktyabrskiy", "pervomayskiy", "sverdlovskiy"]),
  key: z.enum(["air", "safety", "transport", "noise", "comfort", "energy"]),
  value: z.number().int().min(0).max(100),
  sourceType: z.enum(["observed", "modelled"]),
  observedAt: z.string().datetime(),
});

export async function GET(request: Request) {
  try {
    await requireRole(request, ["analyst", "admin"]);
    const db = await getD1();
    const result = await db.prepare("SELECT id, district_id AS districtId, key, value, source_type AS sourceType, observed_at AS observedAt FROM metrics ORDER BY observed_at DESC LIMIT 200").all();
    return Response.json({ metrics: result.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole(request, ["admin"]);
    const payload = metricSchema.parse(await request.json());
    const db = await getD1();
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO metrics (id, district_id, key, value, source_type, observed_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, payload.districtId, payload.key, payload.value, payload.sourceType, payload.observedAt).run();
    await writeAudit({ actorId: actor.id, action: "metric.create", entityType: "metric", entityId: id, after: payload });
    return Response.json({ metric: { id, ...payload } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

