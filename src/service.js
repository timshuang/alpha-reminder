const { fetchAlphaData } = require("./fetcher");
const { extractNormalizedAirdrops } = require("./normalize");
const { sendBarkNotification } = require("./notifier");
const { sleep, formatUtcPlus8Time } = require("./utils");
const { DailyNotifiedStateStore, formatDateKey } = require("./state-store");
const logger = require("./logger");

class AlphaReminderService {
  constructor({
    source,
    bark,
    fetchImpl = fetch,
    notifier = sendBarkNotification,
    now = () => new Date(),
    stateStore = new DailyNotifiedStateStore(),
    backoffDelays = [60_000, 120_000, 180_000]
  }) {
    this.source = source;
    this.bark = bark;
    this.fetchImpl = fetchImpl;
    this.notifier = notifier;
    this.now = now;
    this.stateStore = stateStore;
    this.backoffDelays = backoffDelays;
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
      totalTokens: items.map(i => i.token).join(", "),
      newItems: newItems.length,
      newTokens: newItems.map(i => i.token).join(", ")
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

    let consecutive403 = 0;

    while (!this.stopped) {
      try {
        await this.pollOnce({ notify: true });
        consecutive403 = 0;
      } catch (error) {
        if (error.statusCode === 403) {
          consecutive403++;
          logger.error("API returned 403 (Forbidden).", {
            attempt: consecutive403,
            maxAttempts: 4
          });

          if (consecutive403 >= 4) {
            await this.sendAlert("API\u8fde\u7eed4\u6b21\u8fd4\u56de403\uff0c\u670d\u52a1\u5df2\u505c\u6b62");
            this.stop();
            const { exec } = require("child_process");
            exec("pm2 stop alpha-reminder");
            break;
          }

          const delayMs = this.backoffDelays[consecutive403 - 1];
          logger.info("Retrying in " + (delayMs / 1000) + "s...", { nextAttempt: consecutive403 + 1 });
          this.pendingSleep = sleep(delayMs);
          await this.pendingSleep.promise;
          this.pendingSleep = null;
          continue;
        }

        logger.error("Polling failed.", { error: error.message });
        consecutive403 = 0;
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

  async sendAlert(message) {
    try {
      const now = this.now();
      await this.notifier({
        barkConfig: this.bark,
        item: {
          categoryLabel: "\u670d\u52a1\u544a\u8b66",
          name: message,
          token: "ALERT",
          points: "-",
          amount: "-",
          date: formatDateKey(now),
          time: formatUtcPlus8Time(now),
          phase: "1",
          type: "ALERT",
          status: "manual"
        },
        fetchImpl: this.fetchImpl
      });
    } catch (err) {
      logger.error("Failed to send alert notification.", { error: err.message });
    }
  }
}

module.exports = {
  AlphaReminderService
};
