const { fetchAlphaData } = require("./fetcher");
const { extractNormalizedAirdrops } = require("./normalize");
const { sendBarkNotification } = require("./notifier");
const { sleep } = require("./utils");
const { DailyNotifiedStateStore, formatDateKey } = require("./state-store");
const logger = require("./logger");

class AlphaReminderService {
  constructor({
    source,
    bark,
    fetchImpl = fetch,
    notifier = sendBarkNotification,
    now = () => new Date(),
    stateStore = new DailyNotifiedStateStore()
  }) {
    this.source = source;
    this.bark = bark;
    this.fetchImpl = fetchImpl;
    this.notifier = notifier;
    this.now = now;
    this.stateStore = stateStore;
    this.snapshot = null;
    this.stopped = false;
    this.pendingSleep = null;
  }

  async pollOnce({ notify = true } = {}) {
    const currentDateKey = formatDateKey(this.now());
    this.refreshSnapshot();

    const payload = await fetchAlphaData({
      apiUrl: this.source.apiUrl,
      requestTimeoutMs: this.source.requestTimeoutMs,
      fetchImpl: this.fetchImpl
    });

    const items = extractNormalizedAirdrops(payload, this.now());
    const newItems = [];
    for (const item of items) {
      if (item.isExpired) {
        continue;
      }
      if (!this.shouldNotify(item)) {
        continue;
      }
      newItems.push(item);
    }

    logger.info("Fetched Alpha123 payload.", {
      totalItems: items.length,
      newItems: newItems.length
    });

    if (notify) {
      for (const item of newItems) {
        try {
          await this.notifier({
            barkConfig: this.bark,
            item,
            fetchImpl: this.fetchImpl
          });
          this.recordNotification(currentDateKey, item);
          logger.info("Sent Bark notification.", {
            identityKey: item.identityKey,
            notificationSignature: item.notificationSignature,
            token: item.token
          });
        } catch (error) {
          logger.error("Failed to send Bark notification.", {
            identityKey: item.identityKey,
            notificationSignature: item.notificationSignature,
            error: error.message
          });
        }
      }
    }

    return {
      items,
      newItems
    };
  }

  async run() {
    logger.info("Alpha Reminder started.", {
      apiUrl: this.source.apiUrl,
      pollIntervalMs: this.source.pollIntervalMs
    });

    while (!this.stopped) {
      try {
        await this.pollOnce({ notify: true });
      } catch (error) {
        logger.error("Polling failed.", { error: error.message });
      }

      if (this.stopped) {
        break;
      }
      this.pendingSleep = sleep(this.source.pollIntervalMs);
      await this.pendingSleep.promise;
      this.pendingSleep = null;
    }
  }

  stop() {
    this.stopped = true;
    if (this.pendingSleep) {
      this.pendingSleep.cancel();
      this.pendingSleep = null;
    }
  }

  refreshSnapshot() {
    if (this.snapshot) {
      return;
    }

    this.snapshot = this.stateStore.load();
  }

  shouldNotify(item) {
    this.refreshSnapshot();
    const previous = this.snapshot.items[item.identityKey];
    if (!previous) {
      return true;
    }

    return previous.signature !== item.notificationSignature;
  }

  recordNotification(dateKey, item) {
    this.refreshSnapshot();
    this.snapshot.updatedAtUtcPlus8Date = dateKey;
    this.snapshot.items[item.identityKey] = {
      signature: item.notificationSignature,
      category: item.category,
      date: item.raw && typeof item.raw.date === "string" ? item.raw.date : "",
      lastNotifiedAt: dateKey
    };
    this.stateStore.save(this.snapshot);
  }
}

module.exports = {
  AlphaReminderService
};
