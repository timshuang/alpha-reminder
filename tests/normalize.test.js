const test = require("node:test");
const assert = require("node:assert/strict");
const {
  UNKNOWN_LABEL,
  buildDedupKey,
  extractNormalizedAirdrops
} = require("../src/normalize");
const mixed = require("./fixtures/alpha-mixed.json");

test("buildDedupKey requires token phase date and type", () => {
  assert.equal(
    buildDedupKey({
      token: "AAA",
      phase: 1,
      date: "2026-05-05",
      time: "10:00",
      type: "grab"
    }),
    "AAA|1|2026-05-05|10:00|grab"
  );
  assert.equal(buildDedupKey({ token: "AAA" }), null);
  assert.equal(
    buildDedupKey({
      token: "",
      created_timestamp: 1778137576,
      phase: 1,
      date: "2026-05-07",
      time: "18:00",
      type: "grab"
    }),
    "1778137576|1|2026-05-07|18:00|grab"
  );
});

test("extractNormalizedAirdrops removes duplicates within one batch", () => {
  const items = extractNormalizedAirdrops(
    mixed,
    new Date("2026-05-05T01:00:00+08:00")
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].category, "today");
  assert.equal(items[1].category, "upcoming");
});

test("extractNormalizedAirdrops ignores invalid payloads", () => {
  assert.deepEqual(extractNormalizedAirdrops(null), []);
  assert.deepEqual(extractNormalizedAirdrops({ airdrops: null }), []);
});

test("extractNormalizedAirdrops skips items without enough identity fields", () => {
  const items = extractNormalizedAirdrops({
    airdrops: [
      { token: "AAA", phase: 1, type: "grab" },
      { token: "", date: "2026-05-05", phase: 1, type: "grab" },
      {
        token: "BBB",
        date: "2026-05-05",
        phase: 1,
        type: "grab"
      }
    ]
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].dedupeKey, "BBB|1|2026-05-05|TBA|grab");
});

test("extractNormalizedAirdrops keeps UNKNOWN items when created_timestamp is present", () => {
  const items = extractNormalizedAirdrops(
    {
      airdrops: [
        {
          token: "",
          name: "",
          date: "2026-05-07",
          time: "18:00",
          points: "245",
          type: "grab",
          phase: 1,
          status: "announced",
          created_timestamp: 1778137576
        }
      ]
    },
    new Date("2026-05-07T09:00:00+08:00")
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].dedupeKey, "1778137576|1|2026-05-07|18:00|grab");
  assert.equal(items[0].token, UNKNOWN_LABEL);
  assert.equal(items[0].name, UNKNOWN_LABEL);
  assert.equal(items[0].category, "today");
});
