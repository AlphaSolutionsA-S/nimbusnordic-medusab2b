import { Container, Heading } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import BcReturnExpectedCredit from "@/modules/account/components/bc-return-expected-credit"
import BcReturnLines from "@/modules/account/components/bc-return-lines"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import type { BCReturnDetail } from "@/types/bc-order"

type BcReturnDetailTemplateProps = {
  bcReturn: BCReturnDetail
}

const BcReturnDetailTemplate = ({ bcReturn }: BcReturnDetailTemplateProps) => {
  const t = useTranslations("Account.bcReturnDetailTemplate")
  const locale = useLocale()
  const documentDate = new Date(bcReturn.documentDate)

  return (
    <div className="flex flex-col gap-y-4" data-testid="bc-return-detail">
      <LocalizedClientLink
        href="/account/returns"
        className="text-small-regular text-ui-fg-subtle hover:text-ui-fg-base"
        data-testid="bc-return-back-link"
      >
        {t("backToReturnsLabel")}
      </LocalizedClientLink>

      <Container className="flex flex-col gap-y-4">
        <Heading level="h1">
          {t("returnNumberHeading", { number: bcReturn.number })}
        </Heading>
        <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
          <div>
            <dt className="text-ui-fg-subtle">{t("requestedDateLabel")}</dt>
            <dd className="text-ui-fg-base" data-testid="bc-return-document-date">
              {Number.isNaN(documentDate.getTime())
                ? "-"
                : documentDate.toLocaleDateString(getFormattingLocale(locale))}
            </dd>
          </div>
          <div>
            <dt className="text-ui-fg-subtle">{t("statusLabel")}</dt>
            <dd>
              <span
                className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
                data-testid="bc-return-status"
              >
                {bcReturn.status}
              </span>
            </dd>
          </div>
        </dl>
      </Container>

      <Container>
        <BcReturnLines lines={bcReturn.lines} />
      </Container>

      <Container>
        <BcReturnExpectedCredit expectedCredit={bcReturn.expectedCredit} />
      </Container>
    </div>
  )
}

export default BcReturnDetailTemplate
