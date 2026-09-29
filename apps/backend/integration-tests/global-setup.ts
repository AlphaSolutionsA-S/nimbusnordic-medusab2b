import { assertBusinessCentralTestEnvironment } from "../src/utils/business-central-test-environment";

// Test types whose suites can reach Business Central (directly or via the NIMBUS-148 subscriber).
const BUSINESS_CENTRAL_TEST_TYPES = ["integration:http", "integration:modules"];

export default async function globalSetup(): Promise<void> {
  if (!BUSINESS_CENTRAL_TEST_TYPES.includes(process.env.TEST_TYPE ?? "")) {
    return;
  }

  // Throws before any suite starts, so the whole run aborts.
  assertBusinessCentralTestEnvironment(process.env);
}
