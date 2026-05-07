function formatTypeLabel(type) {
  const normalized = String(type || "").trim().toLowerCase();

  if (!normalized || normalized === "\u7c7b\u578b\u672a\u77e5") {
    return "\u7c7b\u578b\u672a\u77e5";
  }

  if (normalized === "grab") {
    return "\u5148\u5230\u5148\u5f97";
  }

  if (normalized === "tge") {
    return "TGE";
  }

  if (normalized === "pre-tge") {
    return "Pre-TGE";
  }

  return String(type || "").trim() || "-";
}

function buildBarkPayload(item, barkConfig) {
  const categoryLabel = item.categoryLabel || "\u7a7a\u6295\u63d0\u9192";
  const title = `${categoryLabel}: ${item.name} (${item.token})`;
  const bodyLines = [
    `\u6240\u9700\u79ef\u5206: ${item.points}`,
    `\u7a7a\u6295\u6570\u91cf: ${item.amount}`,
    `\u65f6\u95f4: ${item.date} ${item.time}`,
    `\u7c7b\u578b: ${formatTypeLabel(item.type)}`
  ];

  return {
    title,
    body: bodyLines.join("\n"),
    sound: barkConfig.sound,
    group: barkConfig.group,
    level: barkConfig.level,
    url: barkConfig.url
  };
}

async function sendBarkNotification({
  barkConfig,
  item,
  fetchImpl = fetch
}) {
  if (!barkConfig.deviceKey) {
    throw new Error("Missing BARK_DEVICE_KEY.");
  }

  const payload = buildBarkPayload(item, barkConfig);
  const endpoint = `${barkConfig.baseUrl}/${encodeURIComponent(
    barkConfig.deviceKey
  )}`;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Bark request failed with ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Bark returned non-JSON content-type: ${contentType}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(`Bark returned code ${data.code}: ${data.message || "unknown error"}`);
  }

  return data;
}

module.exports = {
  formatTypeLabel,
  buildBarkPayload,
  sendBarkNotification
};
