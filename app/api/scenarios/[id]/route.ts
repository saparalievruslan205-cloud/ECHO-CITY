import { requireRequestUser, roleCanAccess } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getD1 } from "@/lib/runtime";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await context.params;
    const db = await getD1();
    const row = await db.prepare(
      "SELECT id, owner_id AS ownerId, name, request_json AS requestJson, result_json AS resultJson, status, created_at AS createdAt, updated_at AS updatedAt FROM scenarios WHERE id = ?",
    ).bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Сценарий не найден" }, { status: 404 });
    if (!roleCanAccess(String(row.ownerId), user)) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    return Response.json({ scenario: {
      ...row,
      request: JSON.parse(String(row.requestJson)),
      result: row.resultJson ? JSON.parse(String(row.resultJson)) : null,
    } });
  } catch (error) {
    return jsonError(error);
  }
}

