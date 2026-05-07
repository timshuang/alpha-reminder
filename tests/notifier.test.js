const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatTypeLabel,
  buildBarkPayload,
  sendBarkNotification
} = require("../src/notifier");

function createBarkConfig() {
  return {
    sound: "minuet",
    group: "alpha123",
    level: "active",
    url: "https://alpha123.uk/"
  };
}

test("formatTypeLabel maps known types and preserves unknown ones", () => {
  assert.equal(formatTypeLabel("grab"), "\u5148\u5230\u5148\u5f97");
  assert.equal(formatTypeLabel("tge"), "TGE");
  assert.equal(formatTypeLabel("pre-tge"), "Pre-TGE");
  assert.equal(formatTypeLabel("special-mode"), "special-mode");
});

test("buildBarkPayload uses configured sound and unified body format", () => {
  const payload = buildBarkPayload(
    {
      categoryLabel: "\u4eca\u65e5\u7a7a\u6295",
      name: "Alpha A",
      token: "AAA",
      points: "120",
      amount: "500",
      date: "2026-05-05",
      time: "10:00",
      phase: "1",
      type: "grab",
      status: "announced"
    },
    createBarkConfig()
  );

  assert.equal(payload.sound, "minuet");
  assert.equal(payload.group, "alpha123");
  assert.equal(payload.title, "\u4eca\u65e5\u7a7a\u6295: Alpha A (AAA)");
  assert.match(payload.body, /\u6240\u9700\u79ef\u5206: 120/);
  assert.match(payload.body, /\u7a7a\u6295\u6570\u91cf: 500/);
  assert.match(payload.body, /\u65f6\u95f4: 2026-05-05 10:00/);
  assert.match(payload.body, /\u7c7b\u578b: \u5148\u5230\u5148\u5f97/);
  assert.doesNotMatch(payload.body, /Token:/);
  assert.doesNotMatch(payload.body, /Phase:/);
  assert.doesNotMatch(payload.body, /Status:/);
});

test("buildBarkPayload keeps today and upcoming bodies identical except title prefix", () => {
  const baseItem = {
    name: "Example Project",
    token: "EXM",
    points: "245",
    amount: "1000",
    date: "2026-05-08",
    time: "18:00",
    phase: "1",
    type: "pre-tge",
    status: "announced"
  };

  const todayPayload = buildBarkPayload(
    {
      ...baseItem,
      categoryLabel: "\u4eca\u65e5\u7a7a\u6295"
    },
    createBarkConfig()
  );
  const upcomingPayload = buildBarkPayload(
    {
      ...baseItem,
      categoryLabel: "\u7a7a\u6295\u9884\u544a"
    },
    createBarkConfig()
  );

  assert.equal(todayPayload.body, upcomingPayload.body);
  assert.equal(todayPayload.title, "\u4eca\u65e5\u7a7a\u6295: Example Project (EXM)");
  assert.equal(upcomingPayload.title, "\u7a7a\u6295\u9884\u544a: Example Project (EXM)");
});

test("buildBarkPayload falls back to reminder title and placeholder type when date is unavailable", () => {
  const payload = buildBarkPayload(
    {
      categoryLabel: "\u7a7a\u6295\u63d0\u9192",
      name: "ShareX",
      token: "SHARE",
      points: "-",
      amount: "-",
      date: "\u65e5\u671f\u672a\u77e5",
      time: "\u65f6\u95f4\u672a\u77e5",
      phase: "-",
      type: "\u7c7b\u578b\u672a\u77e5",
      status: "announced"
    },
    createBarkConfig()
  );

  assert.equal(payload.title, "\u7a7a\u6295\u63d0\u9192: ShareX (SHARE)");
  assert.match(payload.body, /\u65f6\u95f4: \u65e5\u671f\u672a\u77e5 \u65f6\u95f4\u672a\u77e5/);
  assert.match(payload.body, /\u7c7b\u578b: \u7c7b\u578b\u672a\u77e5/);
});

test("sendBarkNotification rejects non-200 Bark payloads", async () => {
  await assert.rejects(
    sendBarkNotification({
      barkConfig: {
        baseUrl: "https://api.day.app",
        deviceKey: "abc",
        sound: "minuet",
        group: "alpha123",
        level: "active",
        url: "https://alpha123.uk/"
      },
      item: {
        categoryLabel: "\u6d4b\u8bd5\u901a\u77e5",
        name: "Alpha Reminder",
        token: "TEST",
        points: "-",
        amount: "-",
        date: "2026-05-05",
        time: "TBA",
        phase: "1",
        type: "custom-type",
        status: "manual"
      },
      fetchImpl: async () => ({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ code: 500, message: "boom" })
      })
    }),
    /Bark returned code 500/
  );
});

test("installation test notification title is explicit", () => {
  const payload = buildBarkPayload(
    {
      categoryLabel: "\u5b89\u88c5\u6d4b\u8bd5\u901a\u77e5",
      name: "Alpha Reminder",
      token: "TEST",
      points: "-",
      amount: "-",
      date: "2026-05-05",
      time: "TBA",
      phase: "1",
      type: "test",
      status: "manual"
    },
    createBarkConfig()
  );

  assert.equal(payload.title, "\u5b89\u88c5\u6d4b\u8bd5\u901a\u77e5: Alpha Reminder (TEST)");
});
