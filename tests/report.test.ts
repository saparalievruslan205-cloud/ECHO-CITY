import assert from "node:assert/strict";
import test from "node:test";
import { createScenarioPdf } from "../lib/report";
import { runScenario } from "../lib/simulation";

test("generates a valid PDF report", async () => {
  const result = runScenario({
    problem: { type: "noise", coordinates: [74.6036, 42.8772], intensity: 60, radius: 900, durationMinutes: 90, description: "Noisy event" },
    solution: "green-buffer",
    timeOfDay: 20,
    weather: { windSpeed: 7, temperature: 22 },
  });
  const bytes = await createScenarioPdf("ECHO CITY test", result);
  assert.ok(bytes.byteLength > 1000);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
});

