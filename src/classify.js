function parseDateOnly(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUtcPlus8Date(now = new Date()) {
  const utcPlus8Ms = now.getTime() + 8 * 60 * 60 * 1000;
  return new Date(utcPlus8Ms).toISOString().slice(0, 10);
}

function classifyAirdrop(item, now = new Date()) {
  const itemDate = typeof item.date === "string" ? item.date.trim() : "";
  const parsedDate = parseDateOnly(itemDate);
  if (!parsedDate) {
    return "fallback";
  }

  const utcPlus8Today = formatUtcPlus8Date(now);
  return itemDate > utcPlus8Today ? "upcoming" : "today";
}

function classifyLabel(type) {
  if (type === "today") {
    return "\u4eca\u65e5\u7a7a\u6295";
  }

  if (type === "upcoming") {
    return "\u7a7a\u6295\u9884\u544a";
  }

  return "\u7a7a\u6295\u63d0\u9192";
}

module.exports = {
  classifyAirdrop,
  classifyLabel,
  parseDateOnly,
  formatUtcPlus8Date
};
