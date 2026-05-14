function sleep(ms) {
  let settled = false;
  let timeout = null;
  let resolvePromise = null;

  const promise = new Promise((resolve) => {
    resolvePromise = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      resolve();
    };
    timeout = setTimeout(resolvePromise, ms);
  });

  return {
    promise,
    cancel: resolvePromise
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeString(value) {
  return isNonEmptyString(value) ? value.trim() : "";
}

function formatUtcPlus8Date(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(now);
}

function formatUtcPlus8Timestamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type).value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}:${get("second")}.${get("fractionalSecond")}`;

  return `${date}T${time}+08:00`;
}

function formatUtcPlus8Time(now = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

module.exports = {
  sleep,
  isNonEmptyString,
  normalizeString,
  formatUtcPlus8Date,
  formatUtcPlus8Timestamp,
  formatUtcPlus8Time
};
