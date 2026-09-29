type Catalog = Record<string, unknown>

jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(async (namespace: string) => {
    const catalog = require("../../../messages/da.json") as Catalog
    const dict = namespace
      .split(".")
      .reduce<unknown>((acc, part) => (acc as Catalog)?.[part], catalog) as Catalog
    return (key: string) => {
      const value = key
        .split(".")
        .reduce<unknown>((acc, part) => (acc as Catalog)?.[part], dict)
      return typeof value === "string" ? value : key
    }
  }),
}))
jest.mock("@/lib/data/cart", () => ({ retrieveCart: jest.fn(async () => null) }))
jest.mock("@/lib/data/customer", () => ({ retrieveCustomer: jest.fn(async () => null) }))
jest.mock("@/modules/cart/templates", () => ({ __esModule: true, default: () => null }))
jest.mock("@/lib/context/cart-context", () => ({ CartProvider: () => null }))

import { generateMetadata as cartMetadata } from "@/app/[countryCode]/(main)/cart/page"
import { generateMetadata as mainNotFoundMetadata } from "@/app/[countryCode]/(main)/not-found"

describe("generateMetadata follows the active locale", () => {
  it("translates the cart page and not-found metadata into Danish (TC-3)", async () => {
    expect(await cartMetadata()).toEqual({ title: "Kurv", description: "Se din kurv." })
    expect(await mainNotFoundMetadata()).toEqual({
      title: "Siden blev ikke fundet",
      description: "Siden, du forsøgte at tilgå, findes ikke.",
    })
  })
})
