import { requireRequestUser, roleCanAccess } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { createScenarioPdf } from "@/lib/report";
import { sendReportEmail } from "@/lib/email";
import { storePdfReport } from "@/lib/report-storage";
import { getD1, getRuntimeEnv, writeAudit } from "@/lib/runtime";
import type { ScenarioResult } from "@/lib/types";
import { z } from "zod";

const reportSchema = z.object({
  scenarioId: z.string().uuid(),
  email: z.string().email().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const payload = reportSchema.parse(await request.json());
    const db = await getD1();
    const scenario = await db.prepare("SELECT id, owner_id AS ownerId, name, result_json AS resultJson FROM scenarios WHERE id = ?").bind(payload.scenarioId).first<{ id: string; ownerId: string; name: string; resultJson: string | null }>();
    if (!scenario || !scenario.resultJson) return Response.json({ error: "Сначала запустите сценарий" }, { status: 404 });
    if (!roleCanAccess(scenario.ownerId, user)) return Response.json({ error: "Недостаточно прав" }, { status: 403 });

    const reportId = crypto.randomUUID();
    const objectKey = `reports/${user.id}/${reportId}.pdf`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const pdf = await createScenarioPdf(scenario.name, JSON.parse(scenario.resultJson) as ScenarioResult);
    const bucket = (await getRuntimeEnv()).REPORTS;
    if (!bucket) throw new Error("R2 binding REPORTS is unavailable");
    await storePdfReport(bucket, objectKey, pdf);
    await db.prepare("INSERT INTO reports (id, owner_id, scenario_id, object_key, expires_at) VALUES (?, ?, ?, ?, ?)").bind(reportId, user.id, scenario.id, objectKey, expiresAt).run();

    let emailSent = false;
    if (payload.email) {
      try {
        const env = await getRuntimeEnv();
        emailSent = (await sendReportEmail(
          { recipient: payload.email, reportId, requestUrl: request.url },
          { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
        )).sent;
        await db.prepare("INSERT INTO notification_deliveries (id, recipient, subject, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), payload.email, "ECHO CITY report", emailSent ? "sent" : "skipped").run();
      } catch (error) {
        await db.prepare("INSERT INTO notification_deliveries (id, recipient, subject, status, error) VALUES (?, ?, ?, 'failed', ?)").bind(crypto.randomUUID(), payload.email, "ECHO CITY report", error instanceof Error ? error.message : "Delivery failed").run();
      }
    }
    await writeAudit({ actorId: user.id, action: "report.create", entityType: "report", entityId: reportId, after: { scenarioId: scenario.id, expiresAt } });
    return Response.json({ report: { id: reportId, expiresAt, downloadUrl: `/api/reports/${reportId}/download`, emailSent } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
