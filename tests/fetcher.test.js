const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchAlphaData, HttpError } = require("../src/fetcher");

test("fetchAlphaData rejects non-JSON responses", async () => {
  await assert.rejects(
    fetchAlphaData({
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      fetchImpl: async () => ({
        ok: true,
        headers: {
          get() {
            return "text/html";
          }
        },
        json: async () => ({})
      })
    }),
    /non-JSON/
  );
});

test("fetchAlphaData rejects non-200 responses", async () => {
  await assert.rejects(
    fetchAlphaData({
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        headers: {
          get() {
            return "application/json";
          }
        },
        json: async () => ({})
      })
    }),
    /403/
  );
});

test("fetchAlphaData throws HttpError with statusCode for non-200", async () => {
  try {
    await fetchAlphaData({
      apiUrl: "https://example.test/api",
      requestTimeoutMs: 1000,
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        headers: {
          get() {
            return "text/html";
          }
        },
        json: async () => ({})
      })
    });
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal(err.name, "HttpError");
    assert.equal(err.statusCode, 403);
    assert.ok(err.message.includes("403"));
  }
});
