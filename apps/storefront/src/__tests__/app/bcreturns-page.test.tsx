import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  listBCReturns: jest.fn(() => Promise.resolve({ returns: [], count: 0 })),
}))
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/account/returns"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))
// bc-return-overview is itself an async Server Component; React's client test
// renderer can't render an unresolved async component as a nested element.
// It has its own dedicated regression test, so stub it here.
jest.mock("@/modules/account/components/bc-return-overview", () => ({
  __esModule: true,
  default: () => null,
}))

import Returns, { generateMetadata } from "@/app/[countryCode]/(main)/account/@dashboard/returns/page"

describe("Returns page", () => {
  it("renders the extracted heading unchanged", async () => {
    const element = await Returns({ searchParams: Promise.resolve({}) })
    render(element)

    expect(screen.getByText("Returns")).toBeInTheDocument()
  })

  it("translates the page metadata (TC-1)", async () => {
    expect(await generateMetadata()).toEqual({
      title: "Returns",
      description: "Company-wide Business Central return history.",
    })
  })
})
