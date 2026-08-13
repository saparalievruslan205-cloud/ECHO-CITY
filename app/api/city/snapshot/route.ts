import { getCitySnapshot } from "@/lib/city-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getCitySnapshot();
  return Response.json(snapshot, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=540" },
  });
}

