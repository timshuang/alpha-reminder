const { formatUtcPlus8Timestamp } = require("./utils");

function timestamp() {
  return formatUtcPlus8Timestamp();
}

function info(message, meta) {
  if (meta) {
    console.log(`[${timestamp()}] INFO ${message}`, meta);
    return;
  }
  console.log(`[${timestamp()}] INFO ${message}`);
}

function warn(message, meta) {
  if (meta) {
    console.warn(`[${timestamp()}] WARN ${message}`, meta);
    return;
  }
  console.warn(`[${timestamp()}] WARN ${message}`);
}

function error(message, meta) {
  if (meta) {
    console.error(`[${timestamp()}] ERROR ${message}`, meta);
    return;
  }
  console.error(`[${timestamp()}] ERROR ${message}`);
}

module.exports = {
  info,
  warn,
  error
};
