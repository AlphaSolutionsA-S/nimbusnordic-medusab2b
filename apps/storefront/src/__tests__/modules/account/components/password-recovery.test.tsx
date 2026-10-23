import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import PasswordRecovery from "@/modules/account/components/password-recovery"
import {
  requestPasswordReset,
  resetPassword,
} from "@/lib/data/password-recovery"

jest.mock("@/lib/data/password-recovery", () => ({
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  useParams: () => ({ countryCode: "dk" }),
}))

it("acknowledges a public request neutrally and links back to login", async () => {
  jest.mocked(requestPasswordReset).mockResolvedValue({ status: "sent" })
  render(<PasswordRecovery countryCode="dk" />)
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "a@example.test" },
  })
  await act(async () =>
    fireEvent.submit(
      screen.getByRole("button", { name: "Send reset link" }).closest("form")!
    )
  )
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If an account exists"
  )
  expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute(
    "href",
    "/dk/account"
  )
})

it("offers a fresh request for a missing proof without rendering a password form", () => {
  render(<PasswordRecovery countryCode="dk" token="" />)
  expect(screen.getByRole("alert")).toHaveTextContent("invalid or has expired")
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
  expect(
    screen.getByRole("link", { name: "Request a new link" })
  ).toHaveAttribute("href", "/dk/forgot-password")
})

it("uses labelled new-password fields and shows success with normal login", async () => {
  jest.mocked(resetPassword).mockResolvedValue({ status: "success" })
  render(<PasswordRecovery countryCode="dk" token="proof" />)
  expect(screen.getByLabelText("New password")).toHaveAttribute(
    "autocomplete",
    "new-password"
  )
  expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
    "autocomplete",
    "new-password"
  )
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-password" },
  })
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "new-password" },
  })
  await act(async () =>
    fireEvent.submit(
      screen.getByRole("button", { name: "Save new password" }).closest("form")!
    )
  )
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Your password has been changed"
  )
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
})

it("shows translated failure and a fresh-link option after backend proof rejection", async () => {
  jest
    .mocked(resetPassword)
    .mockResolvedValue({ status: "error", error: "invalidLink" })
  render(<PasswordRecovery countryCode="dk" token="proof" />)
  await act(async () =>
    fireEvent.submit(
      screen.getByRole("button", { name: "Save new password" }).closest("form")!
    )
  )
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "invalid or has expired"
    )
  )
  expect(
    screen.getByRole("link", { name: "Request a new link" })
  ).toBeInTheDocument()
})

it("keeps the form available after backend password validation fails", async () => {
  jest
    .mocked(resetPassword)
    .mockResolvedValue({ status: "error", error: "invalidPassword" })
  render(<PasswordRecovery countryCode="dk" token="proof" />)
  await act(async () =>
    fireEvent.submit(
      screen.getByRole("button", { name: "Save new password" }).closest("form")!
    )
  )
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "same password in both fields"
  )
  expect(screen.getByLabelText("New password")).toBeInTheDocument()
})

it("announces loading and prevents repeat submissions while a request is pending", async () => {
  let finish: (value: { status: "sent" }) => void = () => {}
  jest.mocked(requestPasswordReset).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  render(<PasswordRecovery countryCode="dk" />)
  await act(async () =>
    fireEvent.submit(
      screen.getByRole("button", { name: "Send reset link" }).closest("form")!
    )
  )
  expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled()
  await act(async () => finish({ status: "sent" }))
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If an account exists"
  )
})
