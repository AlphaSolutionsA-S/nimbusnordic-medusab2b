"use client"

import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { XCircle } from "@medusajs/icons"
import * as Dialog from "@radix-ui/react-dialog"
import { useTranslations } from "next-intl"

export const RequestQuotePrompt = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const t = useTranslations("Quotes.requestQuotePrompt")

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 data-[state=open]:animate-overlayShow fixed inset-0 z-[75]" />
        <Dialog.Content className="z-[100] data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none txt-compact-medium">
          <Dialog.Title className="flex justify-between font-sans font-medium h2-core text-ui-fg-base">
            {t("title")}
            <Dialog.Close asChild>
              <XCircle className="text-violet11 hover:bg-violet4 focus:shadow-violet7 inline-flex appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] outline-none cursor-pointer" />
            </Dialog.Close>
          </Dialog.Title>

          <div className="p-1">
            <ol className="list-decimal ml-8 my-5">
              <li>
                <Dialog.Close asChild>
                  <LocalizedClientLink
                    className="text-blue-500 cursor-pointer"
                    href="/account"
                  >
                    {t("loginLabel")}
                  </LocalizedClientLink>
                </Dialog.Close>
                {t("orLabel")}
                <Dialog.Close>
                  <LocalizedClientLink
                    className="text-blue-500 cursor-pointer"
                    href="/account"
                  >
                    {t("createAccountLabel")}
                  </LocalizedClientLink>
                </Dialog.Close>
              </li>
              <li>{t("addProductsStep")}</li>
              <li>{t("openCartStep")}</li>
            </ol>

            <p>{t("followUpMessage")}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
