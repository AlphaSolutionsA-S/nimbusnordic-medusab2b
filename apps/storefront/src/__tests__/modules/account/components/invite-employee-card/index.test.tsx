import { fireEvent, render, screen, waitFor } from "@testing-library/react"

jest.mock("@/lib/data/companies", () => ({
  createEmployee: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "se" })),
}))

import { createEmployee } from "@/lib/data/companies"
import InviteEmployeeCard from "@/modules/account/components/invite-employee-card"
import { useParams } from "next/navigation"

const company = { id: "company-1" } as any

const fillAndSubmit = (container: HTMLElement) => {
  const field = (name: string) =>
    container.querySelector(`input[name="${name}"]`) as HTMLInputElement

  fireEvent.change(field("first_name"), { target: { value: "Anna" } })
  fireEvent.change(field("last_name"), { target: { value: "Berg" } })
  fireEvent.change(field("email"), { target: { value: "anna@example.com" } })
  fireEvent.change(field("password"), { target: { value: "secret-pass" } })
  fireEvent.submit(container.querySelector("form") as HTMLFormElement)
}

describe("InviteEmployeeCard", () => {
  beforeEach(() => {
    jest.mocked(createEmployee).mockClear()
    jest.mocked(useParams).mockReturnValue({ countryCode: "se" })
  })

  it("renders the extracted field labels and submit button unchanged", () => {
    render(<InviteEmployeeCard company={company} />)

    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Initial password")).toBeInTheDocument()
    expect(screen.getByText("Send Invite")).toBeInTheDocument()
  })

  it("sends the page country with the unchanged invite fields", async () => {
    const { container } = render(<InviteEmployeeCard company={company} />)
    fillAndSubmit(container)

    await waitFor(() =>
      expect(createEmployee).toHaveBeenCalledWith({
        company_id: "company-1",
        first_name: "Anna",
        last_name: "Berg",
        email: "anna@example.com",
        password: "secret-pass",
        spending_limit: 0,
        is_admin: false,
        country_code: "se",
      })
    )
  })

  it("omits the country when the route segment is not a two-letter code", async () => {
    jest.mocked(useParams).mockReturnValue({ countryCode: "dkx" })

    const { container } = render(<InviteEmployeeCard company={company} />)
    fillAndSubmit(container)

    await waitFor(() => expect(createEmployee).toHaveBeenCalledTimes(1))
    const [payload] = jest.mocked(createEmployee).mock.calls[0]
    // toEqual treats an undefined property as absent, so check the key itself.
    expect(Object.keys(payload)).not.toContain("country_code")
    expect(payload).toEqual({
      company_id: "company-1",
      first_name: "Anna",
      last_name: "Berg",
      email: "anna@example.com",
      password: "secret-pass",
      spending_limit: 0,
      is_admin: false,
    })
  })
})
