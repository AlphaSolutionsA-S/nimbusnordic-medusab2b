jest.mock("@/lib/config", () => ({
  sdk: { auth: { resetPassword: jest.fn(), updateProvider: jest.fn() } },
}))

import { sdk } from "@/lib/config"
import {
  requestPasswordReset,
  resetPassword,
} from "@/lib/data/password-recovery"

const request = jest.mocked(sdk.auth.resetPassword)
const update = jest.mocked(sdk.auth.updateProvider)
const form = (values: Record<string, string>): FormData => {
  const data = new FormData()
  Object.entries(values).forEach(([key, value]) => data.set(key, value))
  return data
}

beforeEach(() => jest.resetAllMocks())

it("requests country-specific recovery without an authenticated session", async () => {
  expect(
    await requestPasswordReset("dk", null, form({ email: "a@example.test" }))
  ).toEqual({ status: "sent" })
  expect(request).toHaveBeenCalledWith("customer", "emailpass", {
    identifier: "a@example.test",
    metadata: { country_code: "dk" },
  })
})

it("rejects malformed request input before transport", async () => {
  expect(
    await requestPasswordReset("dk", null, form({ email: "bad" }))
  ).toEqual({ status: "error", error: "invalidEmail" })
  expect(request).not.toHaveBeenCalled()
})

it("does not expose provider failures or account details", async () => {
  request.mockRejectedValue(new Error("a@example.test secret-token"))
  expect(
    await requestPasswordReset("dk", null, form({ email: "a@example.test" }))
  ).toEqual({ status: "error", error: "unavailable" })
})

it("completes using only the reset proof and password fields", async () => {
  const data = form({
    password: "new-password",
    password_confirmation: "new-password",
    email: "ignored@example.test",
  })
  expect(await resetPassword("reset-proof", null, data)).toEqual({
    status: "success",
  })
  expect(update).toHaveBeenCalledWith(
    "customer",
    "emailpass",
    { password: "new-password", password_confirmation: "new-password" },
    "reset-proof"
  )
})

it.each([
  [400, "invalidPassword"],
  [401, "invalidLink"],
  [500, "unavailable"],
])(
  "maps backend status %s without returning credentials",
  async (status, error) => {
    update.mockRejectedValue({ status, message: "secret-password reset-proof" })
    expect(
      await resetPassword(
        "reset-proof",
        null,
        form({
          password: "new-password",
          password_confirmation: "new-password",
        })
      )
    ).toEqual({ status: "error", error })
  }
)

it("refuses a missing proof without attempting credential update", async () => {
  expect(
    await resetPassword(
      "",
      null,
      form({ password: "new-password", password_confirmation: "new-password" })
    )
  ).toEqual({ status: "error", error: "invalidLink" })
  expect(update).not.toHaveBeenCalled()
})
