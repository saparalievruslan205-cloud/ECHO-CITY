import { requireRequestUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getD1, writeAudit } from "@/lib/runtime";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  filters: z.record(z.string(), z.boolean()).default({}),
});

interface SubscriptionRow {
  id: string;
  email: string;
  filtersJson: string;
  active: number;
  createdAt: string;
}

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const db = await getD1();
    const result = await db.prepare("SELECT id, email, filters_json AS filtersJson, active, created_at AS createdAt FROM subscriptions WHERE owner_id = ? ORDER BY created_at DESC").bind(user.id).all<SubscriptionRow>();
    return Response.json({ subscriptions: result.results.map((row) => ({ ...row, filters: JSON.parse(String(row.filtersJson)), active: Boolean(row.active) })) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const payload = schema.parse(await request.json());
    const id = crypto.randomUUID();
    const db = await getD1();
    await db.prepare("INSERT INTO subscriptions (id, owner_id, email, filters_json, active) VALUES (?, ?, ?, ?, 1)").bind(id, user.id, payload.email, JSON.stringify(payload.filters)).run();
    await writeAudit({ actorId: user.id, action: "subscription.create", entityType: "subscription", entityId: id, after: payload });
    return Response.json({ subscription: { id, ...payload, active: true } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
