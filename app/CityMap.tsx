"use client";

import { useEffect, useRef, useState } from "react";
import type { Layer } from "@deck.gl/core";
import type { CityEvent, ProblemType, ScenarioResult } from "@/lib/types";
import { LoaderCircle, LocateFixed, MousePointer2 } from "lucide-react";

type LayerKey = "transport" | "people" | "air" | "noise" | "energy" | "events";

interface CityMapProps {
  theme: "light" | "dark";
  activeLayers: Set<LayerKey>;
  events: CityEvent[];
  problemPoint: [number, number] | null;
  problemType: ProblemType;
  problemRadius: number;
  result: ScenarioResult | null;
  pickMode: boolean;
  onPick: (coordinates: [number, number]) => void;
  onCancelPick: () => void;
}

type Trip = { path: [number, number][]; timestamps: number[] };

function ringPoints(center: [number, number], radiusMeters: number, count: number) {
  const latitudeScale = radiusMeters / 111_320;
  const longitudeScale = radiusMeters / (111_320 * Math.cos(center[1] * Math.PI / 180));
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      position: [center[0] + Math.cos(angle) * longitudeScale, center[1] + Math.sin(angle) * latitudeScale] as [number, number],
    };
  });
}

type TransportationFeature = {
  properties: Record<string, unknown> | null;
  geometry: {
    type: string;
    coordinates: unknown;
  };
};

const problemLabels: Record<ProblemType, string> = {
  traffic: "Пробка",
  closure: "Перекрытие",
  pollution: "Загрязнение",
  noise: "Шумовая зона",
};

const fieldPoints = [
  { position: [74.52, 42.86], air: 70, noise: 44, energy: 62 },
  { position: [74.57, 42.89], air: 58, noise: 72, energy: 76 },
  { position: [74.61, 42.87], air: 82, noise: 84, energy: 87 },
  { position: [74.65, 42.85], air: 92, noise: 65, energy: 57 },
  { position: [74.59, 42.82], air: 49, noise: 52, energy: 69 },
] as Array<{ position: [number, number]; air: number; noise: number; energy: number }>;

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

export function CityMap({ theme, activeLayers, events, problemPoint, problemType, problemRadius, result, pickMode, onPick, onCancelPick }: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckContainerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onPick);
  const layersRef = useRef(activeLayers);
  const eventsRef = useRef(events);
  const resultRef = useRef(result);
  const problemRef = useRef(problemPoint);
  const problemTypeRef = useRef(problemType);
  const problemRadiusRef = useRef(problemRadius);
  const refreshLayersRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported" | "error">("loading");

  useEffect(() => {
    callbackRef.current = onPick;
    layersRef.current = activeLayers;
    eventsRef.current = events;
    resultRef.current = result;
    problemRef.current = problemPoint;
    problemTypeRef.current = problemType;
    problemRadiusRef.current = problemRadius;
    window.requestAnimationFrame(() => refreshLayersRef.current?.());
  }, [activeLayers, events, onPick, problemPoint, problemRadius, problemType, result]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!supportsWebGL()) {
      const unsupportedTimer = window.setTimeout(() => setState("unsupported"), 0);
      return () => window.clearTimeout(unsupportedTimer);
    }
    let disposed = false;
    let frame = 0;
    let readyTimer = 0;
    let mapReady = false;
    let lastFrame = 0;
    let contextCanvas: HTMLCanvasElement | null = null;
    let map: import("maplibre-gl").Map | null = null;
    let deck: import("@deck.gl/core").Deck | null = null;
    let transportTrips: Trip[] = [];
    let peopleTrips: Trip[] = [];

    async function mount() {
      try {
        const [maplibregl, { Deck }, { ScatterplotLayer, TextLayer }, { TripsLayer }] = await Promise.all([
          import("maplibre-gl"),
          import("@deck.gl/core"),
          import("@deck.gl/layers"),
          import("@deck.gl/geo-layers"),
        ]);
        if (disposed || !containerRef.current || !deckContainerRef.current) return;

        maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

        const lowPowerMode = window.innerWidth < 768;
        map = new maplibregl.Map({
          container: containerRef.current,
          style: theme === "dark" ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron",
          center: [74.595, 42.866],
          zoom: lowPowerMode ? 11.9 : 12.35,
          pitch: lowPowerMode ? 38 : 48,
          bearing: -10,
          canvasContextAttributes: { antialias: !lowPowerMode },
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        const makeLayers = (time: number) => {
          const visible = layersRef.current;
          const layers: Layer[] = [];
          if (visible.has("air")) {
            layers.push(new ScatterplotLayer({
              id: "air-field",
              data: fieldPoints,
              getPosition: (d: typeof fieldPoints[number]) => d.position,
              getRadius: (d: typeof fieldPoints[number]) => 420 + d.air * 3,
              getFillColor: (d: typeof fieldPoints[number]) => d.air > 80 ? [255, 168, 68, 26] : [70, 224, 170, 20],
              radiusUnits: "meters",
              stroked: true,
              getLineColor: [78, 224, 192, 54],
              lineWidthMinPixels: 1,
              pickable: false,
            }));
          }
          if (visible.has("noise")) {
            layers.push(new ScatterplotLayer({
              id: "noise-field",
              data: fieldPoints,
              getPosition: (d: typeof fieldPoints[number]) => d.position,
              getRadius: (d: typeof fieldPoints[number]) => 260 + d.noise * 3,
              getFillColor: [255, 168, 68, 38],
              radiusUnits: "meters",
              pickable: false,
            }));
          }
          if (visible.has("energy")) {
            layers.push(new ScatterplotLayer({
              id: "energy-field",
              data: fieldPoints,
              getPosition: (d: typeof fieldPoints[number]) => d.position,
              getRadius: 145,
              getFillColor: (d: typeof fieldPoints[number]) => [178, 126, 255, Math.min(220, 80 + d.energy)],
              radiusUnits: "meters",
              stroked: true,
              getLineColor: [218, 188, 255, 220],
              lineWidthMinPixels: 2,
            }));
          }
          if (visible.has("transport")) {
            layers.push(new TripsLayer({
              id: "transport-trips",
              data: transportTrips,
              getPath: (d: Trip) => d.path,
              getTimestamps: (d: Trip) => d.timestamps,
              getColor: [30, 205, 255, 230],
              widthMinPixels: 3.2,
              capRounded: true,
              jointRounded: true,
              trailLength: 130,
              currentTime: time,
              opacity: 0.95,
            }));
          }
          if (visible.has("people")) {
            layers.push(new TripsLayer({
              id: "people-trips",
              data: peopleTrips,
              getPath: (d: Trip) => d.path,
              getTimestamps: (d: Trip) => d.timestamps,
              getColor: [95, 255, 185, 230],
              widthMinPixels: 2,
              trailLength: 90,
              currentTime: time,
            }));
          }
          if (visible.has("events")) {
            layers.push(new ScatterplotLayer({
              id: "city-events-halo",
              data: eventsRef.current,
              getPosition: (d: CityEvent) => d.coordinates,
              getRadius: 170,
              getFillColor: (d: CityEvent) => d.severity === "critical" ? [255, 78, 80, 30] : d.severity === "warning" ? [255, 174, 74, 26] : [66, 212, 255, 24],
              radiusUnits: "meters",
              pickable: false,
            }));
            layers.push(new ScatterplotLayer({
              id: "city-events-dot",
              data: eventsRef.current,
              getPosition: (d: CityEvent) => d.coordinates,
              getRadius: 58,
              getFillColor: (d: CityEvent) => d.severity === "critical" ? [255, 78, 80, 245] : d.severity === "warning" ? [255, 174, 74, 245] : [66, 212, 255, 240],
              radiusUnits: "meters",
              stroked: true,
              getLineColor: [255, 255, 255, 220],
              lineWidthMinPixels: 2,
              pickable: false,
            }));
          }
          if (problemRef.current) {
            const currentResult = resultRef.current;
            const noiseMetric = currentResult?.metrics.find((metric) => metric.key === "noise");
            layers.push(new ScatterplotLayer({
              id: "problem-impact-zone",
              data: [{ position: problemRef.current }],
              getPosition: (d: { position: [number, number] }) => d.position,
              getRadius: currentResult?.request.problem.radius ?? problemRadiusRef.current,
              getFillColor: [255, 78, 80, currentResult ? 18 : 38],
              getLineColor: [255, 92, 86, 190],
              radiusUnits: "meters",
              stroked: true,
              lineWidthMinPixels: 2,
            }));
            if (currentResult) {
              const noiseReduction = noiseMetric ? Math.max(0, noiseMetric.before - noiseMetric.after) : 0;
              const residualRadius = currentResult.request.problem.radius * (1 - Math.min(0.52, noiseReduction / 15));
              layers.push(new ScatterplotLayer({
                id: "solution-impact-zone",
                data: [{ position: problemRef.current }],
                getPosition: (d: { position: [number, number] }) => d.position,
                getRadius: residualRadius,
                getFillColor: [70, 224, 170, 34],
                getLineColor: [70, 224, 170, 220],
                radiusUnits: "meters",
                stroked: true,
                lineWidthMinPixels: 3,
              }));
              const pulse = (time % 500) / 500;
              layers.push(new ScatterplotLayer({
                id: "solution-wave",
                data: [{ position: problemRef.current }],
                getPosition: (d: { position: [number, number] }) => d.position,
                getRadius: residualRadius + (currentResult.request.problem.radius - residualRadius) * pulse,
                getFillColor: [70, 224, 170, 0],
                getLineColor: [70, 224, 170, Math.round(210 * (1 - pulse))],
                radiusUnits: "meters",
                stroked: true,
                lineWidthMinPixels: 3,
              }));
              if (currentResult.request.solution === "green-buffer") {
                layers.push(new ScatterplotLayer({
                  id: "green-buffer-trees",
                  data: ringPoints(problemRef.current, residualRadius, 28),
                  getPosition: (d: { position: [number, number] }) => d.position,
                  getRadius: 22,
                  getFillColor: [46, 201, 112, 245],
                  getLineColor: [220, 255, 232, 230],
                  radiusUnits: "meters",
                  stroked: true,
                  lineWidthMinPixels: 1,
                }));
              }
            }
            layers.push(new ScatterplotLayer({
              id: "problem-marker",
              data: [{ position: problemRef.current }],
              getPosition: (d: { position: [number, number] }) => d.position,
              getRadius: 72,
              getFillColor: [255, 78, 80, 250],
              getLineColor: [255, 255, 255, 245],
              radiusUnits: "meters",
              stroked: true,
              lineWidthMinPixels: 3,
            }));
            layers.push(new TextLayer({
              id: "problem-label",
              data: [{
                position: problemRef.current,
                label: currentResult
                  ? `${currentResult.request.solution === "green-buffer" ? "Зелёный шумозащитный пояс" : "Прогноз решения"}${noiseMetric ? ` · ${noiseMetric.before} → ${noiseMetric.after} дБ` : ""}`
                  : problemLabels[problemTypeRef.current],
              }],
              getPosition: (d: { position: [number, number]; label: string }) => d.position,
              getText: (d: { position: [number, number]; label: string }) => d.label,
              getColor: currentResult ? [70, 224, 170, 255] : [255, 255, 255, 255],
              getSize: 13,
              sizeUnits: "pixels",
              getPixelOffset: [0, -24],
              getTextAnchor: "middle",
              getAlignmentBaseline: "bottom",
              fontWeight: 700,
              outlineColor: [5, 18, 30, 240],
              outlineWidth: 3,
              billboard: true,
            }));
          }
          return layers;
        };

        const getViewState = () => {
          const center = map!.getCenter();
          return {
            longitude: center.lng,
            latitude: center.lat,
            zoom: map!.getZoom(),
            pitch: map!.getPitch(),
            bearing: map!.getBearing(),
          };
        };

        // A standalone deck.gl canvas avoids the custom-layer coupling between
        // MapLibre and deck.gl while keeping both cameras precisely synchronized.
        deck = new Deck({
          parent: deckContainerRef.current,
          controller: false,
          initialViewState: getViewState(),
          layers: makeLayers(0),
          useDevicePixels: lowPowerMode ? 1 : true,
        });
        refreshLayersRef.current = () => deck?.setProps({ layers: makeLayers(230) });
        const syncDeckCamera = () => deck?.setProps({ viewState: getViewState() });
        map.on("move", syncDeckCamera);
        map.on("resize", syncDeckCamera);
        const markReady = () => {
          if (!disposed) {
            mapReady = true;
            window.clearTimeout(readyTimer);
            setState("ready");
            if (performance.getEntriesByName("echo-map-ready").length === 0) performance.mark("echo-map-ready");
          }
        };
        readyTimer = window.setTimeout(() => {
          if (!disposed && !mapReady) setState("error");
        }, 15_000);
        map.on("load", () => {
          if (!map || disposed) return;
          map.resize();
          try {
            if (map.getSource("openmaptiles") && !map.getLayer("echo-3d-buildings")) {
              const firstLabel = map.getStyle().layers?.find((layer) => layer.type === "symbol" && "layout" in layer && layer.layout?.["text-field"]);
              map.addLayer({
                id: "echo-3d-buildings",
                source: "openmaptiles",
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 12,
                paint: {
                  "fill-extrusion-color": theme === "dark" ? "#122b40" : "#cbd7df",
                  "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 10],
                  "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                  "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.35, 13, 0.72, 15, 0.86],
                },
              }, firstLabel?.id);
            }
          } catch {
            // The public style may change its source-layer names; the map remains usable.
          }
        });
        const rebuildNetworkTrips = () => {
          if (!map || !map.getSource("openmaptiles")) return;
          try {
            const features = map.querySourceFeatures("openmaptiles", { sourceLayer: "transportation" }) as TransportationFeature[];
            const roads: [number, number][][] = [];
            const walkways: [number, number][][] = [];
            const seen = new Set<string>();
            for (const feature of features) {
              const properties = feature.properties ?? {};
              const classification = `${String(properties.class ?? "")} ${String(properties.subclass ?? "")}`.toLowerCase();
              const target = /path|pedestrian|footway|steps/.test(classification)
                ? walkways
                : /motorway|trunk|primary|secondary|tertiary|minor|service|street/.test(classification)
                  ? roads
                  : null;
              if (!target) continue;
              const geometryLines: unknown[] = feature.geometry.type === "LineString"
                ? [feature.geometry.coordinates]
                : feature.geometry.type === "MultiLineString" && Array.isArray(feature.geometry.coordinates)
                  ? feature.geometry.coordinates
                  : [];
              for (const rawLine of geometryLines) {
                if (!Array.isArray(rawLine)) continue;
                const line = rawLine.filter((point): point is [number, number] => Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number");
                if (line.length < 2) continue;
                const key = `${line[0][0].toFixed(5)},${line[0][1].toFixed(5)}-${line.at(-1)![0].toFixed(5)},${line.at(-1)![1].toFixed(5)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                target.push(line);
              }
            }
            const toTrips = (lines: [number, number][][], limit: number) => lines
              .sort((a, b) => b.length - a.length)
              .slice(0, limit)
              .map((path, index) => {
                const start = (index * 19) % 120;
                const duration = 250 + Math.min(120, path.length * 6);
                return { path, timestamps: path.map((_, pointIndex) => start + (duration * pointIndex) / Math.max(1, path.length - 1)) };
              });
            transportTrips = toTrips(roads, lowPowerMode ? 16 : 34);
            peopleTrips = toTrips(walkways, lowPowerMode ? 8 : 18);
          } catch {
            transportTrips = [];
            peopleTrips = [];
          }
        };
        map.on("idle", rebuildNetworkTrips);
        map.once("idle", () => {
          rebuildNetworkTrips();
          markReady();
        });
        map.on("click", (event) => callbackRef.current([event.lngLat.lng, event.lngLat.lat]));
        map.on("error", (event) => {
          if (event.error?.message?.toLowerCase().includes("webgl")) setState("unsupported");
        });
        contextCanvas = map.getCanvas();
        contextCanvas.addEventListener("webglcontextlost", handleContextLost);

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const targetFrameTime = lowPowerMode ? 1000 / 30 : 1000 / 60;
        const animate = (now: number) => {
          if (disposed || !deck) return;
          frame = requestAnimationFrame(animate);
          if (now - lastFrame < targetFrameTime) return;
          lastFrame = now;
          deck.setProps({ layers: makeLayers((now / 18) % 500) });
        };
        if (reduceMotion) deck.setProps({ layers: makeLayers(230) });
        else frame = requestAnimationFrame(animate);
      } catch {
        if (!disposed) setState("error");
      }
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (!disposed) setState("unsupported");
    };

    void mount();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(readyTimer);
      contextCanvas?.removeEventListener("webglcontextlost", handleContextLost);
      deck?.finalize();
      refreshLayersRef.current = null;
      map?.remove();
    };
  }, [theme]);

  return (
    <div className={`relative size-full overflow-hidden bg-[var(--map-fallback)]${pickMode ? " echo-map-picking" : ""}`} aria-busy={state === "loading"}>
      <div ref={containerRef} className="echo-map-container absolute inset-0" aria-label="Интерактивная 3D-карта Бишкека" />
      <div ref={deckContainerRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_35%,var(--map-vignette)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[var(--surface-base)]/85 to-transparent" />
      {state === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-[var(--map-fallback)]/65 backdrop-blur-sm" role="status">
          <div className="flex items-center gap-3 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-5 py-3 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-panel)]">
            <LoaderCircle className="size-4 animate-spin text-[var(--accent-cyan)]" /> Подключаем цифровую модель города
          </div>
        </div>
      )}
      {(state === "unsupported" || state === "error") && (
        <div className="absolute inset-0 grid place-items-center bg-[var(--map-fallback)] px-5" role="alert">
          <div className="max-w-sm rounded-[var(--panel-radius)] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-6 text-center shadow-[var(--shadow-panel)]">
            <LocateFixed className="mx-auto mb-3 size-6 text-[var(--accent-cyan)]" />
            <p className="font-semibold text-[var(--text-primary)]">{state === "unsupported" ? "3D-карта недоступна в этом браузере" : "Карта не загрузилась"}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{state === "unsupported" ? "Включите WebGL и аппаратное ускорение или откройте сайт в современном браузере." : "Проверьте соединение и повторите загрузку. Аналитика продолжает работать на последнем снимке."}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-xs font-semibold text-[var(--text-primary)]">Повторить</button>
          </div>
        </div>
      )}
      {pickMode && (
        <div className="absolute left-1/2 top-24 z-10 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-[var(--accent-cyan)]/45 bg-[var(--surface-panel-strong)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-action)]">
          <span className="flex items-center gap-2"><MousePointer2 className="size-3.5 text-[var(--accent-cyan)]" /> Укажите точку проблемы</span>
          <button type="button" onClick={onCancelPick} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Отмена</button>
        </div>
      )}
    </div>
  );
}
