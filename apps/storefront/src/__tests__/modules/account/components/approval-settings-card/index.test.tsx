import { fireEvent, render, screen } from "@testing-library/react"

jest.mock("@/lib/data/companies", () => ({
  updateApprovalSettings: jest.fn(),
}))

import ApprovalSettingsCard from "@/modules/account/components/approval-settings-card"

const company = {
  id: "company-1",
  approval_settings: {
    requires_admin_approval: true,
    requires_sales_manager_approval: false,
  },
} as any

const customer = { employee: { is_admin: true } } as any

describe("ApprovalSettingsCard", () => {
  it("renders the extracted labels and tooltip copy unchanged", () => {
    render(<ApprovalSettingsCard company={company} customer={customer} />)

    expect(screen.getByText("Requires Admin Approval")).toBeInTheDocument()
    expect(
      screen.getByText("Requires Sales Manager Approval")
    ).toBeInTheDocument()
    expect(screen.getByText("Yes")).toBeInTheDocument()
    expect(screen.getByText("No")).toBeInTheDocument()
    expect(screen.getByText("Edit")).toBeInTheDocument()
  })

  it("renders the extracted edit-mode buttons unchanged", () => {
    render(<ApprovalSettingsCard company={company} customer={customer} />)

    fireEvent.click(screen.getByText("Edit"))

    expect(screen.getByText("Cancel")).toBeInTheDocument()
    expect(screen.getByText("Save")).toBeInTheDocument()
  })
})
