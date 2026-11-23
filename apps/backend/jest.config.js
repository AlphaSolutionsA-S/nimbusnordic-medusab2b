const { loadEnv } = require("@medusajs/framework/utils");
// The HTTP suites sign tokens with "supersecret", but the test runner reads medusa-config.ts before
// it applies a suite's env, so a different JWT_SECRET in .env fails every login (NIMBUS-236).
// Set before loadEnv: dotenv never overrides an existing variable.
process.env.JWT_SECRET = "supersecret";
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
