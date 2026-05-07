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

module.exports = {
  sleep,
  isNonEmptyString,
  normalizeString
};
