import { requireRequestUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { scenarioRequestSchema } from "@/lib/simulation";
import { getD1, writeAudit } from "@/lib/runtime";
import { z } from "zod";

const saveSchema = z.object({
  name: z.string().trim().min(3).max(100),
  request: scenarioRequestSchema,
});

interface ScenarioRow {
  id: string;
  ownerId: string;
  name: string;
  requestJson: string;
  resultJson: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const db = await getD1();
    const where = user.role === "resident" ? "WHERE owner_id = ?" : "";
    const statement = db.prepare(
      `SELECT id, owner_id AS ownerId, name, request_json AS requestJson, result_json AS resultJson, status, created_at AS createdAt, updated_at AS updatedAt FROM scenarios ${where} ORDER BY updated_at DESC LIMIT 50`,
    );
    const result = user.role === "resident" ? await statement.bind(user.id).all<ScenarioRow>() : await statement.all<ScenarioRow>();
    return Response.json({ scenarios: result.results.map((row) => ({
      ...row,
      request: JSON.parse(String(row.requestJson)),
      result: row.resultJson ? JSON.parse(String(row.resultJson)) : null,
    })) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const payload = saveSchema.parse(await request.json());
    const db = await getD1();
    const id = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO scenarios (id, owner_id, name, request_json, status) VALUES (?, ?, ?, ?, 'draft')",
    ).bind(id, user.id, payload.name, JSON.stringify(payload.request)).run();
    await writeAudit({ actorId: user.id, action: "scenario.create", entityType: "scenario", entityId: id, after: payload });
    return Response.json({ scenario: { id, ownerId: user.id, name: payload.name, request: payload.request, status: "draft" } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
