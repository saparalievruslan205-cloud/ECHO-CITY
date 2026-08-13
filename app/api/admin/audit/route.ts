import { requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getD1 } from "@/lib/runtime";

export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const db = await getD1();
    const result = await db.prepare("SELECT id, actor_id AS actorId, action, entity_type AS entityType, entity_id AS entityId, before_json AS beforeJson, after_json AS afterJson, created_at AS createdAt FROM audit_log ORDER BY created_at DESC LIMIT 200").all();
    return Response.json({ audit: result.results });
  } catch (error) {
    return jsonError(error);
  }
}

