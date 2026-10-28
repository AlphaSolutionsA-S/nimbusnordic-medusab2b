import {
  assertBusinessCentralTestEnvironment,
  parseBusinessCentralEnvironment,
} from "../business-central-test-environment";

const TENANT = "00000000-1111-2222-3333-444444444444";

function discoveryUrl(environment: string): string {
  return `https://api.businesscentral.dynamics.com/v2.0/${TENANT}/${environment}/api/v2.0`;
}

describe("assertBusinessCentralTestEnvironment", () => {
  it("ENV-1: accepts the default test environment", () => {
    expect(
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
      })
    ).toEqual("TestDK");
  });

  it("ENV-2: refuses an environment that is not on the allowlist, without leaking the tenant", () => {
    let message = "";

    try {
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("Production"),
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toEqual(
      "Refusing to run integration tests against Business Central environment 'Production' — not an allowed test environment"
    );
    expect(message).not.toContain(TENANT);
  });

  it("ENV-3: refuses a missing discovery URL", () => {
    expect(() => assertBusinessCentralTestEnvironment({})).toThrow(
      "missing or is not a valid Business Central discovery URL"
    );
  });

  it("ENV-4: refuses malformed discovery URLs", () => {
    const malformed = [
      "not a url",
      `http://api.businesscentral.dynamics.com/v2.0/${TENANT}/TestDK/api/v2.0`,
      `https://example.com/v2.0/${TENANT}/TestDK/api/v2.0`,
      `https://api.businesscentral.dynamics.com/v2.0/${TENANT}`,
    ];

    for (const url of malformed) {
      expect(parseBusinessCentralEnvironment(url)).toBeNull();
      expect(() =>
        assertBusinessCentralTestEnvironment({ BUSINESS_CENTRAL_DISCOVERY_URL: url })
      ).toThrow("Refusing to run integration tests");
    }
  });

  it("passes when the Norwegian discovery URL is unset or blank", () => {
    for (const value of [undefined, "", "  "]) {
      expect(
        assertBusinessCentralTestEnvironment({
          BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
          BUSINESS_CENTRAL_NO_DISCOVERY_URL: value,
        })
      ).toEqual("TestDK");
    }
  });

  it("accepts TestNO as the Norwegian environment with the default allowlist", () => {
    expect(() =>
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
        BUSINESS_CENTRAL_NO_DISCOVERY_URL: discoveryUrl("TestNO"),
      })
    ).not.toThrow();
  });

  it("refuses a Norwegian production environment, naming only the environment", () => {
    let message = "";

    try {
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
        BUSINESS_CENTRAL_NO_DISCOVERY_URL: discoveryUrl("ProductionNO"),
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toEqual(
      "Refusing to run integration tests against Business Central environment 'ProductionNO' — not an allowed test environment"
    );
    expect(message).not.toContain(TENANT);
  });

  it("refuses a malformed Norwegian discovery URL without echoing it", () => {
    const malformed = `http://api.businesscentral.dynamics.com/v2.0/${TENANT}/TestNO/api/v2.0`;

    expect(() =>
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
        BUSINESS_CENTRAL_NO_DISCOVERY_URL: malformed,
      })
    ).toThrow("Refusing to run integration tests");

    try {
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
        BUSINESS_CENTRAL_NO_DISCOVERY_URL: malformed,
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(TENANT);
      expect((error as Error).message).not.toContain("http");
    }
  });

  it("checks the Norwegian environment against a configured allowlist too", () => {
    expect(() =>
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
        BUSINESS_CENTRAL_NO_DISCOVERY_URL: discoveryUrl("TestNO"),
        BUSINESS_CENTRAL_TEST_ENVIRONMENTS: "TestDK",
      })
    ).toThrow("'TestNO'");
  });

  it("ENV-5: honours a configured allowlist and falls back to the default when blank", () => {
    expect(
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("Sandbox"),
        BUSINESS_CENTRAL_TEST_ENVIRONMENTS: " Sandbox , TestDK ",
      })
    ).toEqual("Sandbox");
    expect(
      assertBusinessCentralTestEnvironment({
        BUSINESS_CENTRAL_DISCOVERY_URL: discoveryUrl("TestDK"),
        BUSINESS_CENTRAL_TEST_ENVIRONMENTS: "  ",
      })
    ).toEqual("TestDK");
  });
});
