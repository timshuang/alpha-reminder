const fs = require("node:fs");
const path = require("node:path");
const { formatUtcPlus8Date } = require("./utils");

function formatDateKey(date) {
  return formatUtcPlus8Date(date);
}

class NotificationStateStore {
  constructor({
    filePath = path.join(process.cwd(), "data", "notified-airdrops.json")
  } = {}) {
    this.filePath = filePath;
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return {
        version: 2,
        updatedAtUtcPlus8Date: null,
        items: {}
      };
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        version: 2,
        updatedAtUtcPlus8Date: null,
        items: {}
      };
    }

    if (
      parsed &&
      parsed.version === 2 &&
      parsed.items &&
      typeof parsed.items === "object" &&
      !Array.isArray(parsed.items)
    ) {
      return {
        version: 2,
        updatedAtUtcPlus8Date:
          typeof parsed.updatedAtUtcPlus8Date === "string"
            ? parsed.updatedAtUtcPlus8Date
            : null,
        items: parsed.items
      };
    }

    return {
      version: 2,
      updatedAtUtcPlus8Date: null,
      items: {}
    };
  }

  save(snapshot) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload = {
      version: 2,
      updatedAtUtcPlus8Date: snapshot.updatedAtUtcPlus8Date || null,
      items: snapshot.items || {}
    };
    fs.writeFileSync(this.filePath, `${JSON.stringify(payload, null, 2)}\n`);
  }
}

module.exports = {
  DailyNotifiedStateStore: NotificationStateStore,
  NotificationStateStore,
  formatDateKey
};
