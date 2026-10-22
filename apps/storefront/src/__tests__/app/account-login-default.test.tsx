const redirectMock = jest.fn()
jest.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}))
jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(),
}))

import { retrieveCustomer } from "@/lib/data/customer"
import LoginDefault from "@/app/[countryCode]/(main)/account/@login/default"

describe("account @login default (signed-out deep account link)", () => {
  it("redirects to the country front page and renders nothing", async () => {
    const result = await LoginDefault({
      params: Promise.resolve({ countryCode: "dk" }),
    })

    expect(redirectMock).toHaveBeenCalledTimes(1)
    expect(redirectMock).toHaveBeenCalledWith("/dk")
    expect(result).toBeFalsy()
  })

  it("never loads the customer", async () => {
    await LoginDefault({ params: Promise.resolve({ countryCode: "dk" }) })

    expect(retrieveCustomer).not.toHaveBeenCalled()
  })

  it.each([
    ["a segment that decodes to //evil.example", "/evil.example"],
    ["a segment containing a slash", "evil.example/x"],
    ["a protocol-relative backslash segment", "\\evil.example"],
  ])("keeps %s on our own site", async (_label, countryCode) => {
    await LoginDefault({ params: Promise.resolve({ countryCode }) })

    const target: string = redirectMock.mock.calls[0][0]
    expect(target.startsWith("/")).toBe(true)
    expect(target.startsWith("//")).toBe(false)
    expect(target.slice(1)).not.toMatch(/[/\\]/)
    expect(new URL(target, "https://shop.example").origin).toBe(
      "https://shop.example"
    )
  })
})
