const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildIdentityKey,
  buildNotificationSignature,
  buildDedupKey,
  hasConcreteSchedule,
  isExpiredAirdrop,
  normalizeDisplayValue,
  extractNormalizedAirdrops,
  UNKNOWN_DATE,
  UNKNOWN_TIME,
  UNKNOWN_TYPE
} = require("../src/normalize");
const mixed = require("./fixtures/alpha-mixed.json");

test("normalizeDisplayValue accepts strings and numbers for display fields", () => {
  assert.equal(normalizeDisplayValue("245"), "245");
  assert.equal(normalizeDisplayValue(245), "245");
  assert.equal(normalizeDisplayValue(360), "360");
  assert.equal(normalizeDisplayValue(""), "");
  assert.equal(normalizeDisplayValue(null), "");
  assert.equal(normalizeDisplayValue(undefined), "");
});

test("buildIdentityKey keeps stable lifecycle fields only", () => {
  assert.equal(
    buildIdentityKey({
      token: "AAA",
      id: "warning_1",
      phase: 1,
      date: "2026-05-05",
      time: "10:00",
      type: "grab",
      status: "announced"
    }),
    "token:AAA|phase:1|date:2026-05-05|id:warning_1"
  );
  assert.equal(buildIdentityKey({ token: "AAA" }), "token:AAA");
});

test("buildNotificationSignature only tracks time points and type", () => {
  assert.equal(
    buildNotificationSignature(
      {
        time: "18:00",
        points: "245",
        type: "grab",
        amount: "999"
      },
      "upcoming"
    ),
    "time:18:00|points:245|type:grab"
  );
});

test("buildDedupKey keeps token-only items and includes all available meta", () => {
  assert.equal(
    buildDedupKey({
      token: "AAA",
      id: "warning_1",
      phase: 1,
      date: "2026-05-05",
      time: "10:00",
      type: "grab",
      status: "announced"
    }),
    "token:AAA|phase:1|date:2026-05-05|time:10:00|type:grab|status:announced"
  );
  assert.equal(buildDedupKey({ token: "AAA" }), "token:AAA");
  assert.equal(
    buildDedupKey({
      token: "PLAY",
      created_timestamp: 1778137576,
      phase: 1,
      date: "2026-05-07",
      time: "18:00",
      type: "grab"
    }),
    "token:PLAY|created:1778137576|phase:1|date:2026-05-07|time:18:00|type:grab"
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

test("isExpiredAirdrop only expires items with full date and time", () => {
  assert.equal(
    isExpiredAirdrop(
      { date: "2026-05-07", time: "18:00" },
      new Date("2026-05-08T12:07:00+08:00")
    ),
    true
  );
  assert.equal(
    isExpiredAirdrop(
      { date: "2026-05-07", time: "18:00" },
      new Date("2026-05-07T17:59:00+08:00")
    ),
    false
  );
  assert.equal(
    isExpiredAirdrop(
      { date: "2026-05-08", time: "" },
      new Date("2026-05-08T12:07:00+08:00")
    ),
    false
  );
});

test("extractNormalizedAirdrops only requires token to notify", () => {
  const items = extractNormalizedAirdrops({
    airdrops: [
      { token: "AAA" },
      { token: "", date: "2026-05-05", phase: 1, type: "grab" },
      {
        token: "BBB",
        date: "2026-05-05"
      }
    ]
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].identityKey, "token:AAA");
  assert.equal(
    items[0].notificationSignature,
    "time:\u65f6\u95f4\u672a\u77e5|points:-|type:\u7c7b\u578b\u672a\u77e5"
  );
  assert.equal(items[0].dedupeKey, "token:AAA");
  assert.equal(items[0].hasConcreteSchedule, false);
  assert.equal(items[0].isExpired, false);
  assert.equal(items[0].date, UNKNOWN_DATE);
  assert.equal(items[0].time, UNKNOWN_TIME);
  assert.equal(items[0].type, UNKNOWN_TYPE);
  assert.equal(items[0].category, "fallback");
  assert.equal(items[1].dedupeKey, "token:BBB|date:2026-05-05");
});

test("extractNormalizedAirdrops skips items without token even when created_timestamp is present", () => {
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

  assert.equal(items.length, 0);
});

test("extractNormalizedAirdrops keeps numeric points and amount values", () => {
  const items = extractNormalizedAirdrops(
    {
      airdrops: [
        {
          token: "PLAY",
          name: "PlaysOut",
          date: "2026-05-07",
          time: "18:00",
          points: 245,
          amount: 360,
          type: "grab",
          phase: 1,
          status: "announced"
        }
      ]
    },
    new Date("2026-05-07T09:00:00+08:00")
  );

  assert.equal(items.length, 1);
  assert.equal(hasConcreteSchedule(items[0].raw), true);
  assert.equal(items[0].isExpired, false);
  assert.equal(items[0].points, "245");
  assert.equal(items[0].amount, "360");
});

test("extractNormalizedAirdrops keeps upcoming items when type is missing in live payload shape", () => {
  const items = extractNormalizedAirdrops(
    {
      airdrops: [
        {
          token: "SHARE",
          name: "ShareX",
          date: "2026-05-08",
          time: "20:00",
          points: "",
          phase: 1,
          status: "announced",
          type: "",
          created_timestamp: 1778158884
        }
      ]
    },
    new Date("2026-05-07T09:00:00+08:00")
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].dedupeKey, "token:SHARE|created:1778158884|phase:1|date:2026-05-08|time:20:00|status:announced");
  assert.equal(items[0].identityKey, "token:SHARE|phase:1|date:2026-05-08");
  assert.equal(
    items[0].notificationSignature,
    "time:20:00|points:-|type:\u7c7b\u578b\u672a\u77e5"
  );
  assert.equal(items[0].type, UNKNOWN_TYPE);
  assert.equal(items[0].category, "upcoming");
});

test("extractNormalizedAirdrops keeps only the first entry for the same identity within one batch", () => {
  const items = extractNormalizedAirdrops({
    airdrops: [
      { token: "PLAY" },
      { token: "PLAY", time: "18:00" },
      { token: "PLAY", time: "18:00" }
    ]
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].identityKey, "token:PLAY");
  assert.equal(
    items[0].notificationSignature,
    "time:\u65f6\u95f4\u672a\u77e5|points:-|type:\u7c7b\u578b\u672a\u77e5"
  );
});
