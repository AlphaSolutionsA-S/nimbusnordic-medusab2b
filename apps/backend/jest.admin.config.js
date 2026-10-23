// UI-only Jest configuration for Admin components (jsdom). Kept separate from jest.config.js so the
// backend node/integration setup, including the Business Central globalSetup, is not involved.
module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/src/admin/**/__tests__/**/*.test.tsx"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  // Workspace dependencies include React 19; Admin tests use the backend's React 18 renderer.
  moduleNameMapper: {
    "^react$": require.resolve("react"),
    "^react/jsx-runtime$": require.resolve("react/jsx-runtime"),
    "^react/jsx-dev-runtime$": require.resolve("react/jsx-dev-runtime"),
    // The real dashboard cannot load under jsdom; pages render through a stand-in layout.
    "^@medusajs/dashboard/components$": "<rootDir>/src/admin/__tests__/dashboard-components.tsx",
  },
  transform: {
    "^.+\\.[jt]sx?$": [
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
