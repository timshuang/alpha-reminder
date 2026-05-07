const {
  classifyAirdrop,
  classifyLabel,
  parseUtcPlus8DateTime
} = require("./classify");
const { normalizeString } = require("./utils");

const UNKNOWN_LABEL = "UNKNOWN";
const UNKNOWN_DATE = "\u65e5\u671f\u672a\u77e5";
const UNKNOWN_TIME = "\u65f6\u95f4\u672a\u77e5";
const UNKNOWN_TYPE = "\u7c7b\u578b\u672a\u77e5";

function normalizeMetaValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeString(value);
}

function normalizeDisplayValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function buildIdentityKey(item) {
  const token = normalizeString(item.token);
  if (!token) {
    return null;
  }

  const identityParts = [`token:${token}`];
  const candidateFields = [
    ["phase", item.phase],
    ["date", item.date],
    ["id", item.id]
  ];

  for (const [label, rawValue] of candidateFields) {
    const value = normalizeMetaValue(rawValue);
    if (!value) {
      continue;
    }
    identityParts.push(`${label}:${value}`);
  }

  return identityParts.join("|");
}

function buildNotificationSignature(item, category) {
  const time = normalizeString(item.time) || UNKNOWN_TIME;
  const points = normalizeDisplayValue(item.points) || "-";
  const type = normalizeString(item.type) || UNKNOWN_TYPE;

  return [
    `time:${time}`,
    `points:${points}`,
    `type:${type}`
  ].join("|");
}

function buildDedupKey(item) {
  const token = normalizeString(item.token);
  if (!token) {
    return null;
  }

  const dedupeParts = [`token:${token}`];
  const candidateFields = [
    ["created", item.created_timestamp],
    ["timestamp", item.timestamp],
    ["system", item.system_timestamp],
    ["phase", item.phase],
    ["date", item.date],
    ["time", item.time],
    ["type", item.type],
    ["status", item.status]
  ];

  for (const [label, rawValue] of candidateFields) {
    const value = normalizeMetaValue(rawValue);
    if (!value) {
      continue;
    }
    dedupeParts.push(`${label}:${value}`);
  }

  return dedupeParts.join("|");
}

function hasConcreteSchedule(item) {
  return Boolean(parseUtcPlus8DateTime(normalizeString(item.date), normalizeString(item.time)));
}

function isExpiredAirdrop(item, now = new Date()) {
  const scheduledAt = parseUtcPlus8DateTime(
    normalizeString(item.date),
    normalizeString(item.time)
  );
  if (!scheduledAt) {
    return false;
  }

  return now.getTime() > scheduledAt.getTime();
}

function normalizeAirdrop(raw, now = new Date()) {
  const identityKey = buildIdentityKey(raw);
  if (!identityKey) {
    return null;
  }

  const category = classifyAirdrop(raw, now);
  const notificationSignature = buildNotificationSignature(raw, category);
  const dedupeKey = buildDedupKey(raw);
  const expired = isExpiredAirdrop(raw, now);
  const token = normalizeString(raw.token) || UNKNOWN_LABEL;
  const name = normalizeString(raw.name) || token;
  const date = normalizeString(raw.date) || UNKNOWN_DATE;
  const time = normalizeString(raw.time) || UNKNOWN_TIME;
  const points = normalizeDisplayValue(raw.points) || "-";
  const amount = normalizeDisplayValue(raw.amount) || "-";
  const type = normalizeString(raw.type) || UNKNOWN_TYPE;
  const phase = String(raw.phase ?? "").trim() || "-";
  const status = normalizeString(raw.status) || "-";

  return {
    identityKey,
    notificationSignature,
    dedupeKey,
    hasConcreteSchedule: hasConcreteSchedule(raw),
    isExpired: expired,
    category,
    categoryLabel: classifyLabel(category),
    token,
    name,
    date,
    time,
    points,
    amount,
    type,
    phase,
    status,
    raw
  };
}

function extractNormalizedAirdrops(payload, now = new Date()) {
  if (!payload || !Array.isArray(payload.airdrops)) {
    return [];
  }

  const results = [];
  const seenInBatch = new Set();
  for (const rawItem of payload.airdrops) {
    const normalized = normalizeAirdrop(rawItem, now);
    const batchKey = normalized ? normalized.identityKey : "";
    if (!normalized || seenInBatch.has(batchKey)) {
      continue;
    }
    seenInBatch.add(batchKey);
    results.push(normalized);
  }
  return results;
}

module.exports = {
  UNKNOWN_LABEL,
  UNKNOWN_DATE,
  UNKNOWN_TIME,
  UNKNOWN_TYPE,
  buildIdentityKey,
  buildNotificationSignature,
  buildDedupKey,
  hasConcreteSchedule,
  isExpiredAirdrop,
  normalizeDisplayValue,
  normalizeAirdrop,
  extractNormalizedAirdrops
};
