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
    this.seen = new Set();
    this.stateDate = null;
    this.stopped = false;
    this.pendingSleep = null;
  }

  async pollOnce({ notify = true } = {}) {
    const currentDateKey = formatDateKey(this.now());
    this.refreshSeenState(currentDateKey);

    const payload = await fetchAlphaData({
      apiUrl: this.source.apiUrl,
      requestTimeoutMs: this.source.requestTimeoutMs,
      fetchImpl: this.fetchImpl
    });

    const items = extractNormalizedAirdrops(payload, this.now());
    const newItems = [];
    for (const item of items) {
      if (this.seen.has(item.dedupeKey)) {
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
          this.recordNotification(currentDateKey, item.dedupeKey);
          logger.info("Sent Bark notification.", {
            dedupeKey: item.dedupeKey,
            token: item.token
          });
        } catch (error) {
          logger.error("Failed to send Bark notification.", {
            dedupeKey: item.dedupeKey,
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

  refreshSeenState(dateKey) {
    if (this.stateDate === dateKey) {
      return;
    }

    this.seen = new Set(this.stateStore.load(dateKey));
    this.stateDate = dateKey;
  }

  recordNotification(dateKey, dedupeKey) {
    if (this.stateDate !== dateKey) {
      this.refreshSeenState(dateKey);
    }
    this.seen.add(dedupeKey);
    this.stateStore.save(dateKey, this.seen);
  }
}

module.exports = {
  AlphaReminderService
};
