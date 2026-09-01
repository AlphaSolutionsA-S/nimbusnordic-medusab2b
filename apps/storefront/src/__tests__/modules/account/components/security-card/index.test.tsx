import { render, screen } from "@testing-library/react"
import type { B2BCustomer } from "@/types"

import SecurityCard from "@/modules/account/components/security-card"

describe("SecurityCard", () => {
  it("renders the extracted labels unchanged", () => {
    render(<SecurityCard customer={{} as B2BCustomer} />)

    expect(screen.getByText("Password")).toBeInTheDocument()
    expect(screen.getByText("Edit")).toBeInTheDocument()
  })
})
