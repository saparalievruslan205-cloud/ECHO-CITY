import { getCitySnapshot } from "@/lib/city-data";
import { calculateDistrictRating } from "@/lib/simulation";

export async function GET() {
  const snapshot = await getCitySnapshot();
  const ranking = snapshot.districts
    .map((district) => ({
      districtId: district.districtId,
      districtName: district.districtName,
      rating: calculateDistrictRating(Object.values(district.values)),
      values: district.values,
      sourceType: district.sourceType,
      updatedAt: district.updatedAt,
    }))
    .sort((a, b) => b.rating - a.rating);

  return Response.json({
    city: snapshot.city,
    observedAt: snapshot.observedAt,
    ranking,
    trends: {
      traffic: [64, 68, 72, 88, 81, 70, 67, 74, 91, 79, 71, 65],
      air: [71, 69, 66, 63, 60, 64, 68, 72, 70, 67, 65, 69],
      energy: [58, 55, 57, 62, 69, 75, 81, 77, 73, 68, 64, 61],
    },
    sourceType: "modelled",
  });
}

