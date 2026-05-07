const fs = require("node:fs");
const path = require("node:path");

function parseEnvFile(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadDotEnv(dotEnvPath = path.join(process.cwd(), ".env")) {
  if (!fs.existsSync(dotEnvPath)) {
    return;
  }

  const parsed = parseEnvFile(fs.readFileSync(dotEnvPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function loadConfig() {
  loadDotEnv();

  const barkDeviceKey = process.env.BARK_DEVICE_KEY || "";
  const barkBaseUrl = process.env.BARK_BASE_URL || "https://api.day.app";
  const barkSound = process.env.BARK_SOUND || "minuet";
  const barkGroup = process.env.BARK_GROUP || "alpha123";
  const barkLevel = process.env.BARK_LEVEL || "active";
  const barkUrl = process.env.BARK_URL || "https://alpha123.uk/";
  const apiUrl =
    process.env.ALPHA123_API_URL || "https://alpha123.uk/api/data?fresh=1";
  const pollIntervalSeconds = readPositiveInteger(
    "ALPHA123_POLL_INTERVAL_SECONDS",
    60
  );
  const requestTimeoutMs = readPositiveInteger(
    "ALPHA123_REQUEST_TIMEOUT_MS",
    15000
  );

  return {
    source: {
      apiUrl,
      requestTimeoutMs,
      pollIntervalMs: pollIntervalSeconds * 1000
    },
    bark: {
      baseUrl: barkBaseUrl.replace(/\/+$/, ""),
      deviceKey: barkDeviceKey,
      sound: barkSound,
      group: barkGroup,
      level: barkLevel,
      url: barkUrl
    }
  };
}

module.exports = {
  loadConfig,
  loadDotEnv,
  parseEnvFile
};
