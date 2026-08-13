import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { sendReportEmail } from "../lib/email";
import { getCitySnapshot } from "../lib/city-data";
import { storePdfReport } from "../lib/report-storage";

test("D1 migration applies cleanly and creates all domain tables", async () => {
  const sql = await readFile(new URL("../drizzle/0000_striped_mordo.sql", import.meta.url), "utf8");
  const database = new DatabaseSync(":memory:");
  database.exec(sql);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => String(row.name));
  for (const table of ["users", "districts", "metrics", "events", "problems", "scenarios", "reports", "subscriptions", "notification_deliveries", "audit_log"]) {
    assert.ok(tables.includes(table), `missing table ${table}`);
  }
  database.close();
});

test("city data falls back to a stale snapshot when providers fail", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });
  try {
    const snapshot = await getCitySnapshot();
    assert.equal(snapshot.status, "degraded");
    assert.equal(snapshot.weather.stale, true);
    assert.equal(snapshot.air.stale, true);
    assert.equal(snapshot.districts.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2 adapter stores PDFs with the correct content type", async () => {
  let captured: { key?: string; contentType?: string; size?: number } = {};
  const bucket = {
    put: async (key: string, value: Uint8Array, options: R2PutOptions) => {
      captured = { key, contentType: options.httpMetadata && "contentType" in options.httpMetadata ? options.httpMetadata.contentType : undefined, size: value.byteLength };
      return {} as R2Object;
    },
  } as unknown as R2Bucket;
  await storePdfReport(bucket, "reports/u/r.pdf", new Uint8Array([37, 80, 68, 70]));
  assert.deepEqual(captured, { key: "reports/u/r.pdf", contentType: "application/pdf", size: 4 });
});

test("Resend adapter creates a protected report link and supports a test transport", async () => {
  let request: { url?: string; authorization?: string; body?: Record<string, unknown> } = {};
  const result = await sendReportEmail(
    { recipient: "resident@example.com", reportId: "report-1", requestUrl: "https://echo.example/scenarios" },
    { apiKey: "test-key", from: "ECHO CITY <test@example.com>" },
    async (url, init) => {
      request = {
        url: String(url),
        authorization: new Headers(init?.headers).get("authorization") ?? undefined,
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      };
      return new Response(null, { status: 202 });
    },
  );
  assert.equal(result.sent, true);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.authorization, "Bearer test-key");
  assert.match(String(request.body?.html), /https:\/\/echo\.example\/api\/reports\/report-1\/download/);
});
