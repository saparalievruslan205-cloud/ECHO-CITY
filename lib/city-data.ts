import type { CityEvent, CitySnapshot, DistrictMetric } from "./types";

const DISTRICTS = [
  { id: "leninskiy", name: "Ленинский", values: [68, 78, 70, 61, 72, 67] },
  { id: "oktyabrskiy", name: "Октябрьский", values: [74, 82, 76, 69, 79, 75] },
  { id: "pervomayskiy", name: "Первомайский", values: [63, 75, 66, 58, 69, 71] },
  { id: "sverdlovskiy", name: "Свердловский", values: [59, 72, 62, 55, 65, 64] },
] as const;

export function getDistrictMetrics(at = new Date()): DistrictMetric[] {
  const hourSeed = at.getUTCHours() % 4;
  return DISTRICTS.map((district, index) => {
    const shift = ((hourSeed + index) % 3) - 1;
    return {
      districtId: district.id,
      districtName: district.name,
      values: {
        air: district.values[0] + shift,
        safety: district.values[1],
        transport: district.values[2] - shift,
        noise: district.values[3] + shift,
        comfort: district.values[4],
        energy: district.values[5] - shift,
      },
      sourceType: "modelled",
      updatedAt: at.toISOString(),
    };
  });
}

export function getDefaultEvents(at = new Date()): CityEvent[] {
  const iso = at.toISOString();
  return [
    {
      id: "evt-chuy-repair",
      title: "Сценарий: работы на проспекте Чуй",
      description: "Учебный сценарий сужения проезжей части у улицы Исанова.",
      category: "transport",
      severity: "warning",
      coordinates: [74.5872, 42.8757],
      districtId: "pervomayskiy",
      startsAt: iso,
      sourceUrl: "https://www.bishkek.gov.kg/ru/post",
      sourceType: "modelled",
      updatedAt: iso,
    },
    {
      id: "evt-air-east",
      title: "Повышенный фон PM2.5",
      description: "Модель фиксирует локальное ухудшение качества воздуха в восточной части города.",
      category: "ecology",
      severity: "critical",
      coordinates: [74.635, 42.868],
      districtId: "sverdlovskiy",
      startsAt: iso,
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      sourceType: "modelled",
      updatedAt: iso,
    },
    {
      id: "evt-square",
      title: "Сценарий: событие на Ала-Тоо",
      description: "Учебный сценарий повышенного пешеходного потока и локальных ограничений.",
      category: "event",
      severity: "info",
      coordinates: [74.6036, 42.8772],
      districtId: "pervomayskiy",
      startsAt: iso,
      sourceUrl: "https://www.bishkek.gov.kg/ru/post",
      sourceType: "modelled",
      updatedAt: iso,
    },
  ];
}

let cachedSnapshot: { expiresAt: number; value: CitySnapshot } | null = null;

export function getFallbackSnapshot(stale = false): CitySnapshot {
  const now = new Date();
  return {
    city: "Бишкек",
    observedAt: now.toISOString(),
    status: stale ? "degraded" : "live",
    weather: {
      temperature: 24,
      windSpeed: 9,
      humidity: 38,
      weatherCode: 1,
      sourceType: "observed",
      updatedAt: now.toISOString(),
      stale,
    },
    air: {
      pm25: 34,
      pm10: 51,
      no2: 18,
      aqi: 72,
      sourceType: "observed",
      updatedAt: now.toISOString(),
      stale,
    },
    districts: getDistrictMetrics(now),
    events: getDefaultEvents(now),
    transport: { activeUnits: 684, averageSpeed: 24.8, sourceType: "modelled", updatedAt: now.toISOString() },
    energy: { load: 73, sourceType: "modelled", updatedAt: now.toISOString() },
  };
}

export async function getCitySnapshot(): Promise<CitySnapshot> {
  if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) return cachedSnapshot.value;

  const fallback = cachedSnapshot?.value ?? getFallbackSnapshot(true);
  try {
    const [weatherResponse, airResponse] = await Promise.all([
      fetch("https://api.open-meteo.com/v1/forecast?latitude=42.8746&longitude=74.5698&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FBishkek", { signal: AbortSignal.timeout(4500) }),
      fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=42.8746&longitude=74.5698&current=pm2_5,pm10,nitrogen_dioxide,european_aqi&timezone=Asia%2FBishkek", { signal: AbortSignal.timeout(4500) }),
    ]);
    if (!weatherResponse.ok || !airResponse.ok) throw new Error("External data unavailable");
    const weather = await weatherResponse.json() as { current?: Record<string, number | string> };
    const air = await airResponse.json() as { current?: Record<string, number | string> };
    const now = new Date();
    const value: CitySnapshot = {
      ...getFallbackSnapshot(false),
      observedAt: now.toISOString(),
      weather: {
        temperature: Number(weather.current?.temperature_2m ?? fallback.weather.temperature),
        windSpeed: Number(weather.current?.wind_speed_10m ?? fallback.weather.windSpeed),
        humidity: Number(weather.current?.relative_humidity_2m ?? fallback.weather.humidity),
        weatherCode: Number(weather.current?.weather_code ?? fallback.weather.weatherCode),
        sourceType: "observed",
        updatedAt: String(weather.current?.time ?? now.toISOString()),
        stale: false,
      },
      air: {
        pm25: Number(air.current?.pm2_5 ?? fallback.air.pm25),
        pm10: Number(air.current?.pm10 ?? fallback.air.pm10),
        no2: Number(air.current?.nitrogen_dioxide ?? fallback.air.no2),
        aqi: Number(air.current?.european_aqi ?? fallback.air.aqi),
        sourceType: "observed",
        updatedAt: String(air.current?.time ?? now.toISOString()),
        stale: false,
      },
    };
    cachedSnapshot = { expiresAt: Date.now() + 10 * 60 * 1000, value };
    return value;
  } catch {
    return {
      ...fallback,
      status: "degraded",
      weather: { ...fallback.weather, stale: true },
      air: { ...fallback.air, stale: true },
    };
  }
}
