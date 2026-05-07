const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEnvFile } = require("../src/config");

test("parseEnvFile reads simple env lines", () => {
  const env = parseEnvFile("A=1\nB='hello'\n# comment\nC=\"world\"");
  assert.deepEqual(env, {
    A: "1",
    B: "hello",
    C: "world"
  });
});
