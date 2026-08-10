import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("contains the student, tracking, and admin product routes", async () => {
  const [home, report, track, admin] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/report/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/track/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /view="home"/);
  assert.match(report, /view="report"/);
  assert.match(track, /view="track"/);
  assert.match(admin, /view="admin"/);
});

test("uses D1 and private R2 bindings", async () => {
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "EVIDENCE");
});

test("ships the school logo and social card", async () => {
  const [logo, social] = await Promise.all([
    readFile(new URL("../public/images/chomthong-logo.png", import.meta.url)),
    readFile(new URL("../public/og.png", import.meta.url)),
  ]);
  assert.ok(logo.byteLength > 1000);
  assert.ok(social.byteLength > 1000);
});
