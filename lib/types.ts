export type SourceType = "observed" | "modelled";

export type UserRole = "resident" | "analyst" | "admin";

export type MetricKey =
  | "air"
  | "safety"
  | "transport"
  | "noise"
  | "comfort"
  | "energy";

export interface DistrictMetric {
  districtId: string;
  districtName: string;
  values: Record<MetricKey, number>;
  sourceType: SourceType;
  updatedAt: string;
}

export interface WeatherSnapshot {
  temperature: number;
  windSpeed: number;
  humidity: number;
  weatherCode: number;
  sourceType: SourceType;
  updatedAt: string;
  stale: boolean;
}

export interface AirSnapshot {
  pm25: number;
  pm10: number;
  no2: number;
  aqi: number;
  sourceType: SourceType;
  updatedAt: string;
  stale: boolean;
}

export interface CityEvent {
  id: string;
  title: string;
  description: string;
  category: "transport" | "ecology" | "safety" | "energy" | "event";
  severity: "info" | "warning" | "critical";
  coordinates: [number, number];
  districtId: string;
  startsAt: string;
  sourceUrl: string;
  sourceType: SourceType;
  updatedAt: string;
}

export interface CitySnapshot {
  city: "Бишкек";
  observedAt: string;
  status: "live" | "degraded";
  weather: WeatherSnapshot;
  air: AirSnapshot;
  districts: DistrictMetric[];
  events: CityEvent[];
  activeTransportUnits: number;
  averageSpeed: number;
  energyLoad: number;
}

export type ProblemType = "traffic" | "closure" | "pollution" | "noise";
export type SolutionType =
  | "reroute"
  | "transit-route"
  | "adaptive-lights"
  | "low-emission-zone"
  | "green-buffer";

export interface ScenarioRequest {
  problem: {
    type: ProblemType;
    coordinates: [number, number];
    intensity: number;
    radius: number;
    durationMinutes: number;
    description: string;
  };
  solution: SolutionType;
  timeOfDay: number;
  weather: {
    windSpeed: number;
    temperature: number;
  };
}

export interface ScenarioMetricDelta {
  key: "speed" | "delay" | "pm25" | "noise" | "emissions" | "comfort";
  label: string;
  unit: string;
  before: number;
  after: number;
  delta: number;
  favorable: boolean;
}

export interface ScenarioResult {
  id: string;
  request: ScenarioRequest;
  metrics: ScenarioMetricDelta[];
  confidence: number;
  horizon: {
    unit: "minutes" | "months";
    max: number;
  };
  affectedCorridors: Array<{
    name: string;
    loadBefore: number;
    loadAfter: number;
  }>;
  generatedAt: string;
  disclaimer: string;
}

export interface RealtimeMetricUpdate {
  districtId: string;
  key: MetricKey;
  value: number;
  sourceType: SourceType;
  updatedAt: string;
}

export type RealtimeMessage =
  | { type: "snapshot"; payload: CitySnapshot }
  | { type: "metric.update"; payload: RealtimeMetricUpdate }
  | { type: "event.created"; payload: CityEvent }
  | { type: "scenario.progress"; payload: { scenarioId: string; progress: number } }
  | { type: "heartbeat"; payload: { at: string } };
