const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyAirdrop } = require("../src/classify");

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
      time: "00:30"
    },
    now
  );
  assert.equal(result, "upcoming");
});

test("classifyAirdrop falls back to upcoming when date is missing", () => {
  assert.equal(classifyAirdrop({ time: "09:00" }), "upcoming");
});
