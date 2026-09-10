import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import SkeletonAccountButton from "@/modules/skeletons/components/skeleton-account-button"

describe("SkeletonAccountButton", () => {
  it("renders the reused Account.accountButton.loginLabel unchanged", async () => {
    const element = await SkeletonAccountButton()
    render(element)

    expect(screen.getByText("Log in")).toBeInTheDocument()
  })
})
