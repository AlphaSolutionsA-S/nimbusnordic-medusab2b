import { render, screen } from "@testing-library/react"

import AccountInfo from "@/modules/account/components/account-info"

describe("AccountInfo (unused elsewhere, kept under regression test)", () => {
  it("renders the extracted 'Edit' label, and success/error messages, unchanged", () => {
    render(
      <form>
        <AccountInfo
          label="Email"
          currentInfo="jane@example.com"
          isSuccess
          isError
          clearState={() => {}}
        >
          <span>child</span>
        </AccountInfo>
      </form>
    )

    expect(screen.getByText("Edit")).toBeInTheDocument()
    expect(screen.getByText("Email updated succesfully")).toBeInTheDocument()
    expect(
      screen.getByText("An error occurred, please try again")
    ).toBeInTheDocument()
    expect(screen.getByText("Save changes")).toBeInTheDocument()
  })
})
