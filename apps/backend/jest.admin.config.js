// UI-only Jest configuration for Admin components (jsdom). Kept separate from jest.config.js so the
// backend node/integration setup, including the Business Central globalSetup, is not involved.
module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/src/admin/**/__tests__/**/*.test.tsx"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  transform: {
    "^.+\.[jt]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  setupFilesAfterEnv: ["<rootDir>/src/admin/__tests__/setup.ts"],
};
