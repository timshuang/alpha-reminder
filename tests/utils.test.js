const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatUtcPlus8Date,
  formatUtcPlus8Timestamp
} = require("../src/utils");

test("formatUtcPlus8Date follows UTC+8 instead of machine locale", () => {
  const now = new Date("2026-05-04T16:30:00Z");
  assert.equal(formatUtcPlus8Date(now), "2026-05-05");
});

test("formatUtcPlus8Date returns correct date near midnight", () => {
  const now = new Date("2026-05-04T15:59:59Z");
  assert.equal(formatUtcPlus8Date(now), "2026-05-04");
  const after = new Date("2026-05-04T16:00:00Z");
  assert.equal(formatUtcPlus8Date(after), "2026-05-05");
});

test("formatUtcPlus8Timestamp produces ISO-like string with +08:00", () => {
  const now = new Date("2026-05-04T16:30:27.090Z");
  const ts = formatUtcPlus8Timestamp(now);
  assert.ok(ts.endsWith("+08:00"), `expected +08:00 suffix, got: ${ts}`);
  assert.ok(ts.startsWith("2026-05-05T"), `expected 2026-05-05T prefix, got: ${ts}`);
  assert.ok(ts.includes(":30:27.090"), `expected time :30:27.090, got: ${ts}`);
});

test("formatUtcPlus8Timestamp handles midnight boundary", () => {
  const now = new Date("2026-05-04T15:59:58.500Z");
  const ts = formatUtcPlus8Timestamp(now);
  assert.ok(ts.startsWith("2026-05-04T23:59:"), `expected 2026-05-04T23:59: prefix, got: ${ts}`);
});
