"use server"

import { sdk } from "@/lib/config"
import { z } from "zod"

type RecoveryState =
  | { status: "sent" | "success" }
  | {
      status: "error"
      error: "invalidEmail" | "invalidPassword" | "invalidLink" | "unavailable"
    }
  | null

const requestSchema = z.object({
  email: z.string().trim().email(),
  countryCode: z.string().regex(/^[a-z]{2}$/),
})
const passwordSchema = z.object({
  password: z.string(),
  password_confirmation: z.string(),
})

export async function requestPasswordReset(
  countryCode: string,
  _state: RecoveryState,
  formData: FormData
): Promise<RecoveryState> {
  const input = requestSchema.safeParse({
    email: formData.get("email"),
    countryCode,
  })
  if (!input.success) return { status: "error", error: "invalidEmail" }

  try {
    await sdk.auth.resetPassword("customer", "emailpass", {
      identifier: input.data.email,
      metadata: { country_code: input.data.countryCode },
    })
    return { status: "sent" }
  } catch {
    return { status: "error", error: "unavailable" }
  }
}

export async function resetPassword(
  token: string,
  _state: RecoveryState,
  formData: FormData
): Promise<RecoveryState> {
  if (!z.string().min(1).safeParse(token).success) {
    return { status: "error", error: "invalidLink" }
  }
  const input = passwordSchema.safeParse({
    password: formData.get("password"),
    password_confirmation: formData.get("password_confirmation"),
  })
  if (!input.success) return { status: "error", error: "invalidPassword" }

  try {
    await sdk.auth.updateProvider("customer", "emailpass", input.data, token)
    return { status: "success" }
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? error.status
        : undefined
    return {
      status: "error",
      error:
        status === 401
          ? "invalidLink"
          : status === 400
          ? "invalidPassword"
          : "unavailable",
    }
  }
}
