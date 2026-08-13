import { getDefaultEvents } from "@/lib/city-data";
import { getD1 } from "@/lib/runtime";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  longitude: string;
  latitude: string;
  districtId: string;
  sourceUrl: string;
  sourceType: string;
  startsAt: string;
  updatedAt: string;
}

export async function GET() {
  const defaults = getDefaultEvents();
  try {
    const db = await getD1();
    const result = await db.prepare(
      "SELECT id, title, description, category, severity, longitude, latitude, district_id AS districtId, source_url AS sourceUrl, source_type AS sourceType, starts_at AS startsAt, updated_at AS updatedAt FROM events WHERE status = 'published' ORDER BY starts_at DESC LIMIT 50",
    ).all<EventRow>();
    const stored = result.results.map((row) => ({
      ...row,
      coordinates: [Number(row.longitude), Number(row.latitude)],
    }));
    return Response.json({ events: stored.length > 0 ? stored : defaults });
  } catch {
    return Response.json({ events: defaults, degraded: true });
  }
}
