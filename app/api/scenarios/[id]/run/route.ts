import { requireRequestUser, roleCanAccess } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { runScenario } from "@/lib/simulation";
import { getD1, writeAudit } from "@/lib/runtime";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await context.params;
    const db = await getD1();
    const row = await db.prepare("SELECT owner_id AS ownerId, request_json AS requestJson FROM scenarios WHERE id = ?").bind(id).first<{ ownerId: string; requestJson: string }>();
    if (!row) return Response.json({ error: "Сценарий не найден" }, { status: 404 });
    if (!roleCanAccess(row.ownerId, user)) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    const result = runScenario(JSON.parse(row.requestJson));
    await db.prepare("UPDATE scenarios SET result_json = ?, status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(JSON.stringify(result), id).run();
    await writeAudit({ actorId: user.id, action: "scenario.run", entityType: "scenario", entityId: id, after: result });
    return Response.json({ result });
  } catch (error) {
    return jsonError(error);
  }
}

