const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { AlphaReminderService } = require("../src/service");
const { DailyNotifiedStateStore } = require("../src/state-store");
const emptyFixture = require("./fixtures/alpha-empty.json");
const mixedFixture = require("./fixtures/alpha-mixed.json");

function createJsonResponse(data, overrides = {}) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (name.toLowerCase() === "content-type") {
          return "application/json";
        }
        return null;
      }
    },
    json: async () => data,
    ...overrides
  };
}

function createTempStateStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-reminder-"));
  const filePath = path.join(tempDir, "data", "notified-airdrops.json");
  return {
    tempDir,
    filePath,
    store: new DailyNotifiedStateStore({ filePath })
  };
}

test("pollOnce sends no notifications for empty payload", async () => {
  const notifications = [];
  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse(emptyFixture),
    notifier: async (input) => notifications.push(input),
    now: () => new Date("2026-05-05T01:00:00+08:00")
  });

  const result = await service.pollOnce();
  assert.equal(result.newItems.length, 0);
  assert.equal(notifications.length, 0);
});

test("pollOnce dedupes across runs but accepts new phase/date combinations", async () => {
  const notifications = [];
  const { store } = createTempStateStore();
  const queue = [
    mixedFixture,
    mixedFixture,
    {
      airdrops: [
        mixedFixture.airdrops[0],
        {
          ...mixedFixture.airdrops[0],
          phase: 2
        },
        {
          ...mixedFixture.airdrops[1],
          date: "2026-05-07"
        }
      ]
    }
  ];

  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse(queue.shift()),
    notifier: async ({ item }) => notifications.push(item.dedupeKey),
    now: () => new Date("2026-05-05T01:00:00+08:00"),
    stateStore: store
  });

  const first = await service.pollOnce();
  const second = await service.pollOnce();
  const third = await service.pollOnce();

  assert.equal(first.newItems.length, 2);
  assert.equal(second.newItems.length, 0);
  assert.equal(third.newItems.length, 2);
  assert.deepEqual(notifications, [
    "AAA|1|2026-05-05|10:00|grab",
    "BBB|2|2026-05-06|11:00|tge",
    "AAA|2|2026-05-05|10:00|grab",
    "BBB|2|2026-05-07|11:00|tge"
  ]);
});

test("pollOnce dedupes UNKNOWN items by created_timestamp and accepts new ones", async () => {
  const notifications = [];
  const { store } = createTempStateStore();
  const unknownItem = {
    token: "",
    name: "",
    date: "2026-05-07",
    time: "18:00",
    points: "245",
    type: "grab",
    phase: 1,
    status: "announced",
    created_timestamp: 1778137576
  };
  const queue = [
    { airdrops: [unknownItem] },
    { airdrops: [unknownItem] },
    {
      airdrops: [
        unknownItem,
        {
          ...unknownItem,
          created_timestamp: 1778138000
        }
      ]
    }
  ];

  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse(queue.shift()),
    notifier: async ({ item }) =>
      notifications.push({
        dedupeKey: item.dedupeKey,
        name: item.name,
        token: item.token
      }),
    now: () => new Date("2026-05-07T09:00:00+08:00"),
    stateStore: store
  });

  const first = await service.pollOnce();
  const second = await service.pollOnce();
  const third = await service.pollOnce();

  assert.equal(first.newItems.length, 1);
  assert.equal(second.newItems.length, 0);
  assert.equal(third.newItems.length, 1);
  assert.deepEqual(notifications, [
    {
      dedupeKey: "1778137576|1|2026-05-07|18:00|grab",
      name: "UNKNOWN",
      token: "UNKNOWN"
    },
    {
      dedupeKey: "1778138000|1|2026-05-07|18:00|grab",
      name: "UNKNOWN",
      token: "UNKNOWN"
    }
  ]);
});

test("pollOnce persists same-day notifications across service restarts", async () => {
  const notifications = [];
  const { filePath, store } = createTempStateStore();
  const item = mixedFixture.airdrops[0];

  const firstService = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse({ airdrops: [item] }),
    notifier: async ({ item: notifiedItem }) =>
      notifications.push(notifiedItem.dedupeKey),
    now: () => new Date("2026-05-05T01:00:00+08:00"),
    stateStore: store
  });

  await firstService.pollOnce();

  const persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(persisted.date, "2026-05-05");
  assert.deepEqual(persisted.dedupeKeys, ["AAA|1|2026-05-05|10:00|grab"]);

  const secondService = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse({ airdrops: [item] }),
    notifier: async ({ item: notifiedItem }) =>
      notifications.push(notifiedItem.dedupeKey),
    now: () => new Date("2026-05-05T08:00:00+08:00"),
    stateStore: store
  });

  const result = await secondService.pollOnce();
  assert.equal(result.newItems.length, 0);
  assert.deepEqual(notifications, ["AAA|1|2026-05-05|10:00|grab"]);
});

test("pollOnce resets persisted state on a new day", async () => {
  const notifications = [];
  const { filePath, store } = createTempStateStore();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      date: "2026-05-04",
      dedupeKeys: ["AAA|1|2026-05-05|10:00|grab"]
    })
  );

  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse({ airdrops: [mixedFixture.airdrops[0]] }),
    notifier: async ({ item }) => notifications.push(item.dedupeKey),
    now: () => new Date("2026-05-05T01:00:00+08:00"),
    stateStore: store
  });

  const result = await service.pollOnce();
  assert.equal(result.newItems.length, 1);
  assert.deepEqual(notifications, ["AAA|1|2026-05-05|10:00|grab"]);

  const persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(persisted.date, "2026-05-05");
  assert.deepEqual(persisted.dedupeKeys, ["AAA|1|2026-05-05|10:00|grab"]);
});

test("pollOnce does not persist failed notifications", async () => {
  const { filePath, store } = createTempStateStore();
  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse({ airdrops: [mixedFixture.airdrops[0]] }),
    notifier: async () => {
      throw new Error("Bark down");
    },
    now: () => new Date("2026-05-05T01:00:00+08:00"),
    stateStore: store
  });

  const result = await service.pollOnce();
  assert.equal(result.newItems.length, 1);
  assert.equal(fs.existsSync(filePath), false);
});

test("pollOnce tolerates notifier failures and continues", async () => {
  let attempts = 0;
  const { store } = createTempStateStore();
  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse(mixedFixture),
    notifier: async () => {
      attempts += 1;
      throw new Error("Bark down");
    },
    now: () => new Date("2026-05-05T01:00:00+08:00"),
    stateStore: store
  });

  const result = await service.pollOnce();
  assert.equal(result.newItems.length, 2);
  assert.equal(attempts, 2);
});

test("pollOnce surfaces fetch errors for the runner to log", async () => {
  const { store } = createTempStateStore();
  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      headers: {
        get() {
          return "application/json";
        }
      },
      json: async () => ({})
    }),
    notifier: async () => undefined,
    stateStore: store
  });

  await assert.rejects(service.pollOnce(), /Alpha123 API returned 500/);
});

test("run stops quickly when interrupted during sleep", async () => {
  const { store } = createTempStateStore();
  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 10000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse(emptyFixture),
    notifier: async () => undefined,
    now: () => new Date("2026-05-05T01:00:00+08:00"),
    stateStore: store
  });

  const runPromise = service.run();
  await new Promise((resolve) => setTimeout(resolve, 20));
  service.stop();

  await assert.doesNotReject(
    Promise.race([
      runPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("run did not stop quickly")), 200)
      )
    ])
  );
});
