"use client"

import {
  requestPasswordReset,
  resetPassword,
} from "@/lib/data/password-recovery"
import Button from "@/modules/common/components/button"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { useTranslations } from "next-intl"
import { useActionState } from "react"

export default function PasswordRecovery({
  countryCode,
  token,
}: {
  countryCode: string
  token?: string
}): React.ReactNode {
  const t = useTranslations("Account.recovery")
  const completing = token !== undefined
  const action = completing
    ? resetPassword.bind(null, token)
    : requestPasswordReset.bind(null, countryCode)
  const [state, formAction, pending] = useActionState(action, null)
  const invalidLink =
    (completing && !token) ||
    (state?.status === "error" && state.error === "invalidLink")
  const finished = state?.status === "sent" || state?.status === "success"
  const inputClassName =
    "block w-full h-10 px-4 bg-ui-bg-field rounded-full shadow-borders-base focus:outline-none focus:shadow-borders-interactive-with-active"

  return (
    <div className="content-container py-16 flex justify-center">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <h1 className="text-3xl text-neutral-950">
          {t(completing ? "resetHeading" : "requestHeading")}
        </h1>
        {finished ? (
          <p role="status">
            {t(state.status === "sent" ? "acknowledgement" : "success")}
          </p>
        ) : invalidLink ? (
          <p role="alert">{t("errors.invalidLink")}</p>
        ) : (
          <form
            action={formAction}
            className="flex flex-col gap-4"
            aria-busy={pending}
          >
            <p>{t(completing ? "resetDescription" : "requestDescription")}</p>
            {completing ? (
              <>
                <label htmlFor="recovery-password">{t("passwordLabel")}</label>
                <input
                  id="recovery-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={inputClassName}
                />
                <label htmlFor="recovery-confirmation">
                  {t("confirmationLabel")}
                </label>
                <input
                  id="recovery-confirmation"
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={inputClassName}
                />
              </>
            ) : (
              <>
                <label htmlFor="recovery-email">{t("emailLabel")}</label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={inputClassName}
                />
              </>
            )}
            {state?.status === "error" && (
              <p role="alert">{t(`errors.${state.error}`)}</p>
            )}
            <Button type="submit" disabled={pending} isLoading={pending}>
              {t(
                pending
                  ? "loading"
                  : completing
                  ? "resetSubmit"
                  : "requestSubmit"
              )}
            </Button>
          </form>
        )}
        {invalidLink && (
          <LocalizedClientLink href="/forgot-password" className="underline">
            {t("freshLink")}
          </LocalizedClientLink>
        )}
        <LocalizedClientLink href="/account" className="underline">
          {t("backToLogin")}
        </LocalizedClientLink>
      </div>
    </div>
  )
}
