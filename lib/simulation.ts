import { z } from "zod";
import type {
  ScenarioMetricDelta,
  ScenarioRequest,
  ScenarioResult,
  SolutionType,
} from "./types";

const BISHKEK_BOUNDS = {
  west: 74.45,
  east: 74.72,
  south: 42.78,
  north: 42.95,
};

export const scenarioRequestSchema = z.object({
  problem: z.object({
    type: z.enum(["traffic", "closure", "pollution", "noise"]),
    coordinates: z.tuple([
      z.number().min(BISHKEK_BOUNDS.west).max(BISHKEK_BOUNDS.east),
      z.number().min(BISHKEK_BOUNDS.south).max(BISHKEK_BOUNDS.north),
    ]),
    intensity: z.number().int().min(1).max(100),
    radius: z.number().int().min(100).max(5000),
    durationMinutes: z.number().int().min(10).max(1440),
    description: z.string().trim().min(3).max(500),
  }),
  solution: z.enum([
    "reroute",
    "transit-route",
    "adaptive-lights",
    "low-emission-zone",
    "green-buffer",
  ]),
  timeOfDay: z.number().int().min(0).max(23),
  weather: z.object({
    windSpeed: z.number().min(0).max(80),
    temperature: z.number().min(-45).max(60),
  }),
});

export const problemSchema = scenarioRequestSchema.shape.problem;

const solutionEffect: Record<
  SolutionType,
  { traffic: number; air: number; noise: number; comfort: number }
> = {
  reroute: { traffic: 0.48, air: 0.12, noise: 0.08, comfort: 0.18 },
  "transit-route": { traffic: 0.36, air: 0.28, noise: 0.12, comfort: 0.3 },
  "adaptive-lights": { traffic: 0.54, air: 0.16, noise: 0.1, comfort: 0.2 },
  "low-emission-zone": { traffic: 0.12, air: 0.58, noise: 0.24, comfort: 0.32 },
  "green-buffer": { traffic: 0.04, air: 0.42, noise: 0.46, comfort: 0.52 },
};

const corridorGraph = [
  { name: "пр. Чуй", base: 76, affinity: 0.94 },
  { name: "ул. Киевская", base: 69, affinity: 0.78 },
  { name: "пр. Манаса", base: 82, affinity: 0.88 },
  { name: "ул. Абдрахманова", base: 74, affinity: 0.84 },
  { name: "ул. Ахунбаева", base: 62, affinity: 0.64 },
];

function round(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function spatialDecay(distanceMeters: number, radiusMeters: number) {
  if (distanceMeters <= 0) return 1;
  if (distanceMeters >= radiusMeters * 2) return 0;
  return round(Math.exp(-2.4 * (distanceMeters / radiusMeters)), 4);
}

export function calculateDistrictRating(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function computeCorridorLoads(request: ScenarioRequest) {
  const peak = request.timeOfDay >= 7 && request.timeOfDay <= 10 || request.timeOfDay >= 17 && request.timeOfDay <= 20;
  const intensity = request.problem.intensity / 100;
  const closureBoost = request.problem.type === "closure" ? 0.38 : request.problem.type === "traffic" ? 0.25 : 0.08;
  const relief = solutionEffect[request.solution].traffic;

  return corridorGraph.map((corridor, index) => {
    const coordinateSeed = Math.abs(request.problem.coordinates[0] * 1000 + request.problem.coordinates[1] * 100 + index * 17) % 1;
    const loadBefore = Math.min(100, corridor.base + (peak ? 8 : 0) + intensity * closureBoost * 28 * corridor.affinity);
    const redistributed = index === 0 ? 0 : intensity * relief * (6 + coordinateSeed * 5);
    const loadAfter = Math.max(28, loadBefore - intensity * relief * 28 + redistributed);
    return {
      name: corridor.name,
      loadBefore: round(loadBefore),
      loadAfter: round(loadAfter),
    };
  });
}

function metric(
  key: ScenarioMetricDelta["key"],
  label: string,
  unit: string,
  before: number,
  after: number,
  lowerIsBetter: boolean,
): ScenarioMetricDelta {
  const safeAfter = round(after);
  const delta = round(safeAfter - before);
  return {
    key,
    label,
    unit,
    before,
    after: safeAfter,
    delta,
    favorable: lowerIsBetter ? delta <= 0 : delta >= 0,
  };
}

export function runScenario(input: ScenarioRequest): ScenarioResult {
  const request = scenarioRequestSchema.parse(input);
  const intensity = request.problem.intensity / 100;
  const radiusFactor = Math.min(1.35, request.problem.radius / 1800);
  const peakFactor = request.timeOfDay >= 7 && request.timeOfDay <= 10 || request.timeOfDay >= 17 && request.timeOfDay <= 20 ? 1.18 : 0.92;
  const windRelief = Math.min(0.28, request.weather.windSpeed / 60);
  const effect = solutionEffect[request.solution];
  const problemTraffic = request.problem.type === "traffic" || request.problem.type === "closure" ? 1 : 0.45;
  const problemAir = request.problem.type === "pollution" ? 1.3 : 0.68;
  const problemNoise = request.problem.type === "noise" ? 1.35 : 0.62;

  const baseline = {
    speed: round(27 - intensity * 12 * problemTraffic * peakFactor),
    delay: round(13 + intensity * 26 * problemTraffic * peakFactor),
    pm25: round(29 + intensity * 22 * problemAir * radiusFactor * (1 - windRelief)),
    noise: round(58 + intensity * 17 * problemNoise),
    emissions: round(10.8 + intensity * 7.2 * problemTraffic),
    comfort: round(72 - intensity * 24 * Math.max(problemTraffic, problemAir, problemNoise)),
  };

  const trafficGain = intensity * effect.traffic * 16;
  const airGain = intensity * effect.air * 18 * (1 + windRelief);
  const noiseGain = intensity * effect.noise * 13;
  const comfortGain = intensity * effect.comfort * 21;

  const metrics = [
    metric("speed", "Средняя скорость", "км/ч", baseline.speed, baseline.speed + trafficGain, false),
    metric("delay", "Задержка", "мин", baseline.delay, baseline.delay - trafficGain * 1.15, true),
    metric("pm25", "PM2.5", "мкг/м³", baseline.pm25, baseline.pm25 - airGain, true),
    metric("noise", "Уровень шума", "дБ", baseline.noise, baseline.noise - noiseGain, true),
    metric("emissions", "Выбросы CO₂", "т/ч", baseline.emissions, baseline.emissions - airGain * 0.27 - trafficGain * 0.08, true),
    metric("comfort", "Индекс комфорта", "/100", baseline.comfort, Math.min(96, baseline.comfort + comfortGain), false),
  ];

  const infrastructure = request.solution === "green-buffer" || request.solution === "low-emission-zone";
  const confidence = Math.round(
    Math.max(54, Math.min(91, 82 - request.problem.radius / 300 + request.problem.description.length / 18)),
  );

  return {
    id: crypto.randomUUID(),
    request,
    metrics,
    confidence,
    horizon: infrastructure ? { unit: "months", max: 12 } : { unit: "minutes", max: 180 },
    affectedCorridors: computeCorridorLoads(request),
    generatedAt: new Date().toISOString(),
    disclaimer: "Иллюстративная модель. Результат не является официальным инженерным расчётом.",
  };
}

