const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { AlphaReminderService } = require("../src/service");
const { DailyNotifiedStateStore, formatDateKey } = require("../src/state-store");
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

test("pollOnce filters expired items with concrete schedule", async () => {
  const notifications = [];
  const { store } = createTempStateStore();
  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () =>
      createJsonResponse({
        airdrops: [{ token: "PLAY", date: "2026-05-07", time: "18:00", phase: 1, type: "grab" }]
      }),
    notifier: async ({ item }) => notifications.push(item.token),
    now: () => new Date("2026-05-08T12:07:00+08:00"),
    stateStore: store
  });

  const result = await service.pollOnce();
  assert.equal(result.items.length, 1);
  assert.equal(result.newItems.length, 0);
  assert.equal(notifications.length, 0);
});

test("pollOnce allows first-time same-day items without time", async () => {
  const notifications = [];
  const { store } = createTempStateStore();
  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () =>
      createJsonResponse({
        airdrops: [{ token: "SHARE", date: "2026-05-08", phase: 1 }]
      }),
    notifier: async ({ item }) => notifications.push(item.identityKey),
    now: () => new Date("2026-05-08T12:07:00+08:00"),
    stateStore: store
  });

  const result = await service.pollOnce();
  assert.equal(result.newItems.length, 1);
  assert.deepEqual(notifications, ["token:SHARE|phase:1|date:2026-05-08"]);
});

test("pollOnce sends first preview once and suppresses unchanged preview across days", async () => {
  const notifications = [];
  const { store } = createTempStateStore();
  const queue = [
    {
      airdrops: [{ token: "AAA", date: "2026-05-09", phase: 1 }]
    },
    {
      airdrops: [{ token: "AAA", date: "2026-05-09", phase: 1 }]
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
    now: () => new Date(queue.length === 2 ? "2026-05-07T08:00:00+08:00" : "2026-05-08T08:00:00+08:00"),
    stateStore: store
  });

  const first = await service.pollOnce();
  const second = await service.pollOnce();

  assert.equal(first.newItems.length, 1);
  assert.equal(second.newItems.length, 0);
  assert.equal(notifications.length, 1);
});

test("pollOnce re-notifies when preview gains time points or type but not amount", async () => {
  const notifications = [];
  const { store } = createTempStateStore();
  const queue = [
    { airdrops: [{ token: "PLAY", date: "2026-05-09", phase: 1 }] },
    { airdrops: [{ token: "PLAY", date: "2026-05-09", phase: 1, time: "18:00" }] },
    { airdrops: [{ token: "PLAY", date: "2026-05-09", phase: 1, time: "18:00", points: "245" }] },
    { airdrops: [{ token: "PLAY", date: "2026-05-09", phase: 1, time: "18:00", points: "245", amount: "999" }] },
    { airdrops: [{ token: "PLAY", date: "2026-05-09", phase: 1, time: "18:00", points: "245", amount: "999", type: "grab" }] }
  ];

  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse(queue.shift()),
    notifier: async ({ item }) => notifications.push(item.notificationSignature),
    now: () => new Date("2026-05-08T09:00:00+08:00"),
    stateStore: store
  });

  await service.pollOnce();
  await service.pollOnce();
  await service.pollOnce();
  await service.pollOnce();
  await service.pollOnce();

  assert.deepEqual(notifications, [
    "time:\u65f6\u95f4\u672a\u77e5|points:-|type:\u7c7b\u578b\u672a\u77e5",
    "time:18:00|points:-|type:\u7c7b\u578b\u672a\u77e5",
    "time:18:00|points:245|type:\u7c7b\u578b\u672a\u77e5",
    "time:18:00|points:245|type:grab"
  ]);
});

test("pollOnce does not re-notify on day switch when only category changes", async () => {
  const notifications = [];
  const { filePath, store } = createTempStateStore();
  const item = { token: "AAA", date: "2026-05-09", time: "18:00", phase: 1, type: "grab" };

  const firstService = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse({ airdrops: [item] }),
    notifier: async ({ item: notifiedItem }) =>
      notifications.push(notifiedItem.category),
    now: () => new Date("2026-05-08T01:00:00+08:00"),
    stateStore: store
  });

  await firstService.pollOnce();

  const persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(persisted.version, 2);
  assert.equal(persisted.items["token:AAA|phase:1|date:2026-05-09"].signature, "time:18:00|points:-|type:grab");

  const secondService = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse({ airdrops: [item] }),
    notifier: async ({ item: notifiedItem }) =>
      notifications.push(notifiedItem.category),
    now: () => new Date("2026-05-09T08:00:00+08:00"),
    stateStore: store
  });

  const result = await secondService.pollOnce();
  assert.equal(result.newItems.length, 0);
  assert.deepEqual(notifications, ["upcoming"]);
});

test("state store uses UTC+8 date keys", () => {
  assert.equal(formatDateKey(new Date("2026-05-07T16:30:00Z")), "2026-05-08");
});

test("pollOnce migrates old daily state format without crashing", async () => {
  const notifications = [];
  const { filePath, store } = createTempStateStore();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      date: "2026-05-04",
      dedupeKeys: ["legacy-key"]
    })
  );

  const service = new AlphaReminderService({
    source: {
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      pollIntervalMs: 1000
    },
    bark: {},
    fetchImpl: async () => createJsonResponse({ airdrops: [{ token: "AAA", date: "2026-05-09", phase: 1 }] }),
    notifier: async ({ item }) => notifications.push(item.identityKey),
    now: () => new Date("2026-05-07T01:00:00+08:00"),
    stateStore: store
  });

  const result = await service.pollOnce();
  assert.equal(result.newItems.length, 1);
  assert.deepEqual(notifications, ["token:AAA|phase:1|date:2026-05-09"]);

  const persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(persisted.version, 2);
  assert.ok(persisted.items["token:AAA|phase:1|date:2026-05-09"]);
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
