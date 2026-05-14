const { loadConfig } = require("./config");
const { AlphaReminderService } = require("./service");
const { sendBarkNotification } = require("./notifier");
const { formatUtcPlus8Date } = require("./utils");

async function run() {
  const command = process.argv[2] || "run";
  const config = loadConfig();

  if (command === "test-bark") {
    await sendBarkNotification({
      barkConfig: config.bark,
      item: {
        categoryLabel: "\u5b89\u88c5\u6d4b\u8bd5\u901a\u77e5",
        name: "Alpha Reminder",
        token: "TEST",
        points: "-",
        amount: "-",
        date: formatUtcPlus8Date(),
        time: "TBA",
        phase: "1",
        type: "test",
        status: "manual"
      }
    });
    console.log("Bark test notification sent.");
    return;
  }

  const service = new AlphaReminderService(config);

  if (command === "dry-run") {
    const result = await service.pollOnce({ notify: false });
    console.log(JSON.stringify(result.newItems, null, 2));
    return;
  }

  try {
    await sendBarkNotification({
      barkConfig: config.bark,
      item: {
        categoryLabel: "\u670d\u52a1\u542f\u52a8\u6d4b\u8bd5",
        name: "Alpha Reminder",
        token: "TEST",
        points: "-",
        amount: "-",
        date: formatUtcPlus8Date(),
        time: "TBA",
        phase: "1",
        type: "test",
        status: "manual"
      }
    });
    console.log("Startup bark test notification sent.");
  } catch (error) {
    console.error("Failed to send startup bark test notification:", error.message);
  }

  process.on("SIGINT", () => {
    service.stop();
  });
  process.on("SIGTERM", () => {
    service.stop();
  });

  await service.run();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
