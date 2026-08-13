"use client";

import { useEffect, useRef, useState } from "react";
import type { Layer } from "@deck.gl/core";
import type { CityEvent, ScenarioResult } from "@/lib/types";
import { LoaderCircle, LocateFixed, MousePointer2 } from "lucide-react";

type LayerKey = "transport" | "people" | "air" | "noise" | "energy" | "events";

interface CityMapProps {
  theme: "light" | "dark";
  activeLayers: Set<LayerKey>;
  events: CityEvent[];
  problemPoint: [number, number] | null;
  result: ScenarioResult | null;
  pickMode: boolean;
  onPick: (coordinates: [number, number]) => void;
}

const transportTrips = [
  { path: [[74.481, 42.875], [74.53, 42.876], [74.58, 42.876], [74.63, 42.877], [74.69, 42.878]], timestamps: [0, 120, 240, 360, 480] },
  { path: [[74.602, 42.802], [74.601, 42.835], [74.601, 42.872], [74.602, 42.905], [74.603, 42.934]], timestamps: [0, 110, 220, 330, 440] },
  { path: [[74.512, 42.82], [74.545, 42.843], [74.585, 42.861], [74.626, 42.88], [74.665, 42.903]], timestamps: [0, 100, 200, 300, 400] },
] as Array<{ path: [number, number][]; timestamps: number[] }>;

const peopleTrips = [
  { path: [[74.591, 42.873], [74.597, 42.876], [74.604, 42.877], [74.612, 42.879]], timestamps: [0, 150, 300, 450] },
  { path: [[74.616, 42.842], [74.611, 42.853], [74.607, 42.865], [74.604, 42.877]], timestamps: [20, 150, 280, 410] },
] as Array<{ path: [number, number][]; timestamps: number[] }>;

const fieldPoints = [
  { position: [74.52, 42.86], air: 70, noise: 44, energy: 62 },
  { position: [74.57, 42.89], air: 58, noise: 72, energy: 76 },
  { position: [74.61, 42.87], air: 82, noise: 84, energy: 87 },
  { position: [74.65, 42.85], air: 92, noise: 65, energy: 57 },
  { position: [74.59, 42.82], air: 49, noise: 52, energy: 69 },
] as Array<{ position: [number, number]; air: number; noise: number; energy: number }>;

interface LocalRoad {
  path: [number, number][];
  major: boolean;
}

const localRoads: LocalRoad[] = [
  ...Array.from({ length: 13 }, (_, index) => {
    const longitude = 74.505 + index * 0.015;
    return {
      path: [[longitude - 0.004, 42.805], [longitude, 42.85], [longitude + 0.003, 42.925]] as [number, number][],
      major: index === 3 || index === 6 || index === 9,
    };
  }),
  ...Array.from({ length: 10 }, (_, index) => {
    const latitude = 42.815 + index * 0.0115;
    return {
      path: [[74.49, latitude - 0.002], [74.59, latitude], [74.695, latitude + 0.002]] as [number, number][],
      major: index === 3 || index === 6,
    };
  }),
];

export function CityMap({ theme, activeLayers, events, problemPoint, result, pickMode, onPick }: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckContainerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onPick);
  const layersRef = useRef(activeLayers);
  const eventsRef = useRef(events);
  const resultRef = useRef(result);
  const problemRef = useRef(problemPoint);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    callbackRef.current = onPick;
    layersRef.current = activeLayers;
    eventsRef.current = events;
    resultRef.current = result;
    problemRef.current = problemPoint;
  }, [activeLayers, events, onPick, problemPoint, result]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let frame = 0;
    let readyTimer = 0;
    let map: import("maplibre-gl").Map | null = null;
    let deck: import("@deck.gl/core").Deck | null = null;

    async function mount() {
      try {
        const maplibregl = await import("maplibre-gl");
        const [{ Deck }, { PathLayer, ScatterplotLayer }, { TripsLayer }] = await Promise.all([
          import("@deck.gl/core"),
          import("@deck.gl/layers"),
          import("@deck.gl/geo-layers"),
        ]);
        if (disposed || !containerRef.current || !deckContainerRef.current) return;

        maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

        map = new maplibregl.Map({
          container: containerRef.current,
          style: theme === "dark" ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron",
          center: [74.595, 42.866],
          zoom: 12.1,
          pitch: 55,
          bearing: -14,
          canvasContextAttributes: { antialias: true },
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        const makeLayers = (time: number) => {
          const visible = layersRef.current;
          const layers: Layer[] = [
            new PathLayer({
              id: "local-street-structure",
              data: localRoads,
              getPath: (d: LocalRoad) => d.path,
              getColor: (d: LocalRoad) => theme === "dark"
                ? (d.major ? [32, 151, 190, 205] : [55, 91, 111, 125])
                : (d.major ? [27, 149, 183, 205] : [105, 151, 169, 115]),
              getWidth: (d: LocalRoad) => d.major ? 4 : 1.5,
              widthUnits: "pixels",
              widthMinPixels: 1,
              jointRounded: true,
              capRounded: true,
            }),
          ];
          if (visible.has("air")) {
            layers.push(new ScatterplotLayer({
              id: "air-field",
              data: fieldPoints,
              getPosition: (d: typeof fieldPoints[number]) => d.position,
              getRadius: (d: typeof fieldPoints[number]) => 700 + d.air * 11,
              getFillColor: (d: typeof fieldPoints[number]) => d.air > 80 ? [255, 98, 84, 48] : [70, 224, 170, 38],
              radiusUnits: "meters",
              stroked: true,
              getLineColor: [78, 224, 192, 90],
              lineWidthMinPixels: 1,
              pickable: false,
            }));
          }
          if (visible.has("noise")) {
            layers.push(new ScatterplotLayer({
              id: "noise-field",
              data: fieldPoints,
              getPosition: (d: typeof fieldPoints[number]) => d.position,
              getRadius: (d: typeof fieldPoints[number]) => 300 + d.noise * 6,
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
              getPath: (d: typeof transportTrips[number]) => d.path,
              getTimestamps: (d: typeof transportTrips[number]) => d.timestamps,
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
              getPath: (d: typeof peopleTrips[number]) => d.path,
              getTimestamps: (d: typeof peopleTrips[number]) => d.timestamps,
              getColor: [95, 255, 185, 230],
              widthMinPixels: 2,
              trailLength: 90,
              currentTime: time,
            }));
          }
          if (visible.has("events")) {
            layers.push(new ScatterplotLayer({
              id: "city-events",
              data: eventsRef.current,
              getPosition: (d: CityEvent) => d.coordinates,
              getRadius: 135,
              getFillColor: (d: CityEvent) => d.severity === "critical" ? [255, 78, 80, 230] : d.severity === "warning" ? [255, 174, 74, 230] : [66, 212, 255, 220],
              radiusUnits: "meters",
              stroked: true,
              getLineColor: [255, 255, 255, 220],
              lineWidthMinPixels: 2,
              pickable: true,
            }));
          }
          if (problemRef.current) {
            layers.push(new ScatterplotLayer({
              id: "problem-point",
              data: [{ position: problemRef.current }],
              getPosition: (d: { position: [number, number] }) => d.position,
              getRadius: resultRef.current ? resultRef.current.request.problem.radius : 320,
              getFillColor: [255, 78, 80, resultRef.current ? 44 : 66],
              getLineColor: [255, 92, 86, 245],
              radiusUnits: "meters",
              stroked: true,
              lineWidthMinPixels: 3,
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
          useDevicePixels: window.innerWidth < 768 ? 1 : true,
        });
        const syncDeckCamera = () => deck?.setProps({ viewState: getViewState() });
        map.on("move", syncDeckCamera);
        map.on("resize", syncDeckCamera);
        const markReady = () => {
          if (!disposed) {
            setState("ready");
            if (performance.getEntriesByName("echo-map-ready").length === 0) performance.mark("echo-map-ready");
          }
        };
        map.once("render", markReady);
        readyTimer = window.setTimeout(markReady, 2500);
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
                minzoom: 13,
                paint: {
                  "fill-extrusion-color": theme === "dark" ? "#122b40" : "#cbd7df",
                  "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 10],
                  "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                  "fill-extrusion-opacity": 0.78,
                },
              }, firstLabel?.id);
            }
          } catch {
            // The public style may change its source-layer names; the map remains usable.
          }
          markReady();
        });
        map.on("click", (event) => callbackRef.current([event.lngLat.lng, event.lngLat.lat]));
        map.on("error", (event) => {
          if (event.error?.message?.includes("WebGL")) setState("error");
        });

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const animate = (now: number) => {
          if (disposed || !deck) return;
          deck.setProps({ layers: makeLayers(reduceMotion ? 230 : (now / 18) % 500) });
          frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      } catch {
        if (!disposed) setState("error");
      }
    }

    void mount();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(readyTimer);
      deck?.finalize();
      map?.remove();
    };
  }, [theme]);

  return (
    <div className="relative size-full overflow-hidden bg-[var(--map-fallback)]">
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
      {state === "error" && (
        <div className="absolute inset-0 echo-map-grid grid place-items-center" role="alert">
          <div className="max-w-sm rounded-[var(--panel-radius)] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-6 text-center shadow-[var(--shadow-panel)]">
            <LocateFixed className="mx-auto mb-3 size-6 text-[var(--accent-cyan)]" />
            <p className="font-semibold text-[var(--text-primary)]">Карта временно недоступна</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Аналитика и симулятор продолжают работать на последнем снимке данных.</p>
          </div>
        </div>
      )}
      {pickMode && (
        <div className="pointer-events-none absolute left-1/2 top-24 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--accent-cyan)]/45 bg-[var(--surface-panel-strong)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-action)]">
          <MousePointer2 className="size-3.5 text-[var(--accent-cyan)]" /> Укажите точку проблемы на карте
        </div>
      )}
      <div className="pointer-events-none absolute bottom-6 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border border-[var(--accent-cyan)]/15 echo-radar" aria-hidden="true" />
    </div>
  );
}
