const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyAirdrop, formatUtcPlus8Date } = require("../src/classify");

test("classifyAirdrop marks same-day item as today", () => {
  const now = new Date("2026-05-05T01:00:00+08:00");
  const result = classifyAirdrop(
    {
      date: "2026-05-05",
      time: "18:00"
    },
    now
  );
  assert.equal(result, "today");
});

test("classifyAirdrop marks future-day item as upcoming", () => {
  const now = new Date("2026-05-05T01:00:00+08:00");
  const result = classifyAirdrop(
    {
      date: "2026-05-06",
      time: ""
    },
    now
  );
  assert.equal(result, "upcoming");
});

test("classifyAirdrop treats past dates as today for title purposes", () => {
  const now = new Date("2026-05-05T12:00:00+08:00");
  assert.equal(classifyAirdrop({ date: "2026-05-04" }, now), "today");
});

test("classifyAirdrop falls back when date is missing", () => {
  assert.equal(classifyAirdrop({ time: "09:00" }), "fallback");
});

test("classifyAirdrop falls back when date is invalid", () => {
  assert.equal(classifyAirdrop({ date: "2026/05/05" }), "fallback");
});

test("formatUtcPlus8Date follows UTC+8 instead of machine locale", () => {
  const now = new Date("2026-05-04T16:30:00Z");
  assert.equal(formatUtcPlus8Date(now), "2026-05-05");
});
