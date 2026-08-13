import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the ECHO CITY dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /ECHO/);
  assert.match(html, /CITY/);
  assert.match(html, /Симулятор решений|Создать городскую проблему/);
  assert.match(html, /цифровой двойник Бишкека/i);
  assert.match(html, /id="city-main"/);
  assert.match(html, /aria-label="Основные разделы"/);
  assert.match(html, /Сценарий: работы на проспекте Чуй/);
  assert.match(html, /href="\/signin-with-chatgpt\?return_to=%2F"/);
  assert.doesNotMatch(html, /--:--:--|<div hidden/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
