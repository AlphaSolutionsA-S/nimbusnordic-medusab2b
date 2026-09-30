import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import { OFFICIAL_ISO_COUNTRY_CODES, isAllowedCountryCode } from "../country-code";

const ARTIFACTS_PATH = "issues/NIMBUS-145/artifacts";

/*
  Walks up to the repo root instead of using a fixed "../" depth: the unit run also executes the
  compiled copy of this test under apps/backend/.medusa/server, which sits two levels deeper.
*/
function findArtifactsDir(): string {
  let dir = __dirname;

  while (!existsSync(resolve(dir, ARTIFACTS_PATH))) {
    const parent = dirname(dir);

    if (parent === dir) {
      throw new Error(`${ARTIFACTS_PATH} not found above ${__dirname}`);
    }

    dir = parent;
  }

  return resolve(dir, ARTIFACTS_PATH);
}

const ARTIFACTS_DIR = findArtifactsDir();

type JsonSchemaWithAddress = {
  definitions: {
    address: { properties: { country: { pattern: string } } };
  };
};

function loadJsonSchemaCountryPattern(): RegExp {
  const schema = JSON.parse(
    readFileSync(resolve(ARTIFACTS_DIR, "canonical-order-schema.json"), "utf8")
  ) as JsonSchemaWithAddress;

  return new RegExp(schema.definitions.address.properties.country.pattern);
}

function loadXsdCountryPattern(): RegExp {
  const xsd = readFileSync(
    resolve(ARTIFACTS_DIR, "canonical-order-schema.xsd"),
    "utf8"
  );
  const match =
    /<xs:simpleType name="countryCode">[\s\S]*?<xs:pattern value="([^"]+)"\/>/.exec(
      xsd
    );

  if (!match) {
    throw new Error("countryCode simpleType with a pattern not found in the XSD");
  }

  // XSD patterns are implicitly anchored.
  return new RegExp(`^(?:${match[1]})$`);
}

function variantsOf(code: string): string[] {
  return [
    code,
    code.toLowerCase(),
    `${code[0]}${code[1].toLowerCase()}`,
    ` ${code} `,
    `\t${code.toLowerCase()}\n`,
    `\r\n${code}\r\n`,
  ];
}

describe("APIM country shape check vs backend rule (NIMBUS-171)", () => {
  const patterns = [
    ["JSON Schema", loadJsonSchemaCountryPattern()],
    ["XSD", loadXsdCountryPattern()],
  ] as const;

  it("TC-1: every value the backend accepts passes both APIM shape checks", () => {
    for (const [, pattern] of patterns) {
      for (const code of OFFICIAL_ISO_COUNTRY_CODES) {
        for (const value of variantsOf(code)) {
          expect(isAllowedCountryCode(value)).toBe(true);
          expect(pattern.test(value)).toBe(true);
        }
      }
    }
  });

  it("TC-2: both APIM shape checks reject values that are not two letters", () => {
    for (const [, pattern] of patterns) {
      for (const value of ["Denmark", "DNK", "D", "", "   ", "D1", "D K"]) {
        expect(pattern.test(value)).toBe(false);
      }
    }
  });

  it("TC-3: two-letter non-codes pass APIM and are left to the backend", () => {
    for (const [, pattern] of patterns) {
      for (const value of ["XX", "XK", "uk"]) {
        expect(pattern.test(value)).toBe(true);
        expect(isAllowedCountryCode(value)).toBe(false);
      }
    }
  });
});
