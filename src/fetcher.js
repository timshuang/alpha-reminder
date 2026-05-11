async function fetchAlphaData({ apiUrl, requestTimeoutMs, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetchImpl(apiUrl, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "user-agent": "AlphaReminder/0.1.1",
        "referer": "https://alpha123.uk/"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Alpha123 API returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Alpha123 API returned non-JSON content-type: ${contentType}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchAlphaData
};
