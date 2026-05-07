const { classifyAirdrop, classifyLabel } = require("./classify");
const { normalizeString } = require("./utils");

const UNKNOWN_LABEL = "UNKNOWN";

function buildDedupKey(item) {
  const token = normalizeString(item.token);
  const phase = String(item.phase ?? "").trim();
  const date = normalizeString(item.date);
  const time = normalizeString(item.time);
  const type = normalizeString(item.type);
  const createdTimestamp = String(item.created_timestamp ?? "").trim();

  if (!phase || !date || !type) {
    return null;
  }

  const identity = token || createdTimestamp;
  if (!identity) {
    return null;
  }

  return [identity, phase, date, time || "TBA", type].join("|");
}

function normalizeAirdrop(raw, now = new Date()) {
  const dedupeKey = buildDedupKey(raw);
  if (!dedupeKey) {
    return null;
  }

  const category = classifyAirdrop(raw, now);
  const token = normalizeString(raw.token) || UNKNOWN_LABEL;
  const name = normalizeString(raw.name) || token;
  const date = normalizeString(raw.date);
  const time = normalizeString(raw.time) || "TBA";
  const points = normalizeString(raw.points) || "-";
  const amount = normalizeString(raw.amount) || "-";
  const type = normalizeString(raw.type) || "-";
  const phase = String(raw.phase ?? "").trim();
  const status = normalizeString(raw.status) || "-";

  return {
    dedupeKey,
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
    if (!normalized || seenInBatch.has(normalized.dedupeKey)) {
      continue;
    }
    seenInBatch.add(normalized.dedupeKey);
    results.push(normalized);
  }
  return results;
}

module.exports = {
  UNKNOWN_LABEL,
  buildDedupKey,
  normalizeAirdrop,
  extractNormalizedAirdrops
};
