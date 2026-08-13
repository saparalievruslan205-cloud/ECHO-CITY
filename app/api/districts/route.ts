import { getDistrictMetrics } from "@/lib/city-data";

export async function GET() {
  return Response.json({ districts: getDistrictMetrics() });
}

