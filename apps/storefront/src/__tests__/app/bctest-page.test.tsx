import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  listBusinessCentralOperations: jest.fn(() =>
    Promise.reject(new Error("boom"))
  ),
}))

import BcTestPage from "@/app/[countryCode]/(main)/bctest/page"

describe("BcTestPage", () => {
  it("renders the extracted heading and error copy unchanged", async () => {
    const element = await BcTestPage()
    render(element)

    expect(
      screen.getByText("Business Central API Operations")
    ).toBeInTheDocument()
    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByText("boom")).toBeInTheDocument()
  })
})
