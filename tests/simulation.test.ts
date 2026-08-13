import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDistrictRating,
  computeCorridorLoads,
  runScenario,
  scenarioRequestSchema,
  spatialDecay,
} from "../lib/simulation";
import type { ScenarioRequest } from "../lib/types";

const request: ScenarioRequest = {
  problem: {
    type: "traffic",
    coordinates: [74.6036, 42.8772],
    intensity: 80,
    radius: 1500,
    durationMinutes: 120,
    description: "Пробка на центральном перекрёстке",
  },
  solution: "adaptive-lights",
  timeOfDay: 18,
  weather: { windSpeed: 9, temperature: 24 },
};

test("validates scenario bounds and input ranges", () => {
  assert.equal(scenarioRequestSchema.safeParse(request).success, true);
  assert.equal(scenarioRequestSchema.safeParse({ ...request, problem: { ...request.problem, intensity: 101 } }).success, false);
  assert.equal(scenarioRequestSchema.safeParse({ ...request, problem: { ...request.problem, coordinates: [0, 0] } }).success, false);
});

test("traffic intervention improves speed and delay", () => {
  const result = runScenario(request);
  const speed = result.metrics.find((metric) => metric.key === "speed");
  const delay = result.metrics.find((metric) => metric.key === "delay");
  assert.ok(speed && speed.after > speed.before && speed.favorable);
  assert.ok(delay && delay.after < delay.before && delay.favorable);
  assert.equal(result.horizon.unit, "minutes");
  assert.match(result.disclaimer, /не является официальным/);
});

test("green infrastructure uses a long-term horizon and improves air", () => {
  const result = runScenario({ ...request, problem: { ...request.problem, type: "pollution" }, solution: "green-buffer" });
  const air = result.metrics.find((metric) => metric.key === "pm25");
  assert.equal(result.horizon.unit, "months");
  assert.ok(air && air.after < air.before);
});

test("green buffer visibly reduces a noise problem", () => {
  const result = runScenario({ ...request, problem: { ...request.problem, type: "noise" }, solution: "green-buffer" });
  const noise = result.metrics.find((metric) => metric.key === "noise");
  assert.equal(result.horizon.unit, "months");
  assert.ok(noise && noise.after < noise.before && noise.favorable);
  assert.ok(noise && noise.before - noise.after >= 4);
});

test("spatial decay and district rating are stable", () => {
  assert.equal(spatialDecay(0, 1000), 1);
  assert.equal(spatialDecay(2000, 1000), 0);
  assert.ok(spatialDecay(500, 1000) > spatialDecay(1000, 1000));
  assert.equal(calculateDistrictRating([70, 80, 90]), 80);
});

test("road graph redistributes corridor loads", () => {
  const loads = computeCorridorLoads(request);
  assert.equal(loads.length, 5);
  assert.ok(loads.some((corridor) => corridor.loadAfter !== corridor.loadBefore));
  assert.ok(loads.every((corridor) => corridor.loadAfter >= 0 && corridor.loadAfter <= 100));
});
