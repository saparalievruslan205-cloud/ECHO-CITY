import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("public district API returns four sourced districts", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("http://localhost/api/districts"), env, ctx);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.districts.length, 4);
  assert.ok(payload.districts.every((item) => item.sourceType === "modelled" && item.updatedAt));
});

test("resident and admin guards reject anonymous requests", async () => {
  const { requireRequestUser, requireRole } = await import("../lib/auth.ts");
  await assert.rejects(
    requireRequestUser(new Request("http://localhost/api/problems")),
    (error) => error instanceof Response && error.status === 401,
  );
  await assert.rejects(
    requireRole(new Request("http://localhost/api/admin/audit"), ["admin"]),
    (error) => error instanceof Response && error.status === 401,
  );
});

test("realtime endpoint enforces WebSocket handshake and local polling fallback", async () => {
  const worker = await loadWorker();
  const plain = await worker.fetch(new Request("http://localhost/api/realtime"), env, ctx);
  const upgrade = await worker.fetch(new Request("http://localhost/api/realtime", { headers: { upgrade: "websocket" } }), env, ctx);
  assert.equal(plain.status, 426);
  assert.equal(upgrade.status, 426);
});
