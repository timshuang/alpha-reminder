function parseBeijingDateTime(date, time) {
  if (!date) {
    return null;
  }

  const normalizedTime = time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "12:00:00";
  const parsed = new Date(`${date}T${normalizedTime}+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfLocalDay(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function classifyAirdrop(item, now = new Date()) {
  const dateTime = parseBeijingDateTime(item.date, item.time);
  if (!dateTime) {
    return "upcoming";
  }

  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  return dateTime < tomorrowStart ? "today" : "upcoming";
}

function classifyLabel(type) {
  return type === "today" ? "\u4eca\u65e5\u7a7a\u6295" : "\u7a7a\u6295\u9884\u544a";
}

module.exports = {
  classifyAirdrop,
  classifyLabel,
  parseBeijingDateTime
};
