const { loadEnv } = require("@medusajs/framework/utils");
// The test runner reads medusa-config.ts before it applies a suite's env, so the values the HTTP
// suites rely on are pinned here, before loadEnv (dotenv never overrides a set variable): they
// sign tokens with "supersecret" and expect email links on https://shop.example.test (NIMBUS-236).
process.env.JWT_SECRET = "supersecret";
process.env.STORE_CORS = "https://shop.example.test";
// Load .env from this package dir so DATABASE_URL resolves regardless of invocation cwd.
loadEnv("test", __dirname);

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/"],
  setupFiles: ["./integration-tests/setup.js"],
  globalSetup: "./integration-tests/global-setup.ts",
};

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/**/*.spec.[jt]s"];
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"];
}
