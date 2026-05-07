const fs = require("node:fs");
const path = require("node:path");

function formatDateKey(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

class DailyNotifiedStateStore {
  constructor({
    filePath = path.join(process.cwd(), "data", "notified-airdrops.json")
  } = {}) {
    this.filePath = filePath;
  }

  load(dateKey) {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.date !== dateKey ||
      !Array.isArray(parsed.dedupeKeys)
    ) {
      return [];
    }

    return parsed.dedupeKeys.filter((value) => typeof value === "string");
  }

  save(dateKey, dedupeKeys) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload = {
      date: dateKey,
      dedupeKeys: Array.from(dedupeKeys)
    };
    fs.writeFileSync(this.filePath, `${JSON.stringify(payload, null, 2)}\n`);
  }
}

module.exports = {
  DailyNotifiedStateStore,
  formatDateKey
};
