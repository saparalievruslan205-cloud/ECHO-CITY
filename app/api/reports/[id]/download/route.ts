import { requireRequestUser, roleCanAccess } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getD1, getRuntimeEnv } from "@/lib/runtime";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await context.params;
    const db = await getD1();
    const report = await db.prepare("SELECT owner_id AS ownerId, object_key AS objectKey, expires_at AS expiresAt FROM reports WHERE id = ?").bind(id).first<{ ownerId: string; objectKey: string; expiresAt: string }>();
    if (!report) return Response.json({ error: "Отчёт не найден" }, { status: 404 });
    if (!roleCanAccess(report.ownerId, user)) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    if (new Date(report.expiresAt).getTime() < Date.now()) return Response.json({ error: "Срок хранения отчёта истёк" }, { status: 410 });
    const object = await (await getRuntimeEnv()).REPORTS?.get(report.objectKey);
    if (!object) return Response.json({ error: "Файл отчёта недоступен" }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="echo-city-${id}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
