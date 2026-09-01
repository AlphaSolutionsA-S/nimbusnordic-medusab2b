"use client"

import { HttpTypes } from "@medusajs/types"
import { Table, Text } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import Markdown from "react-markdown"
import Accordion from "./accordion"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const t = useTranslations("Products.tabs")
  const tabs = [
    {
      label: t("descriptionLabel"),
      component: <ProductSpecsTab product={product} />,
    },
    {
      label: t("specificationsLabel"),
      component: <ProductSpecificationsTab product={product} />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple" className="flex flex-col gap-y-2">
        {tabs.map((tab, i) => (
          <Accordion.Item
            className="bg-neutral-100 small:px-24 px-6"
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ProductSpecsTab = ({ product }: ProductTabsProps) => {
  return (
    <div className="text-small-regular py-8 xl:w-2/3">
      <Markdown
        components={{
          p: ({ children }) => (
            <Text className="text-neutral-950 mb-2">{children}</Text>
          ),
          h2: ({ children }) => (
            <Text className="text-xl text-neutral-950 my-4 font-semibold">
              {children}
            </Text>
          ),
          h3: ({ children }) => (
            <Text className="text-lg text-neutral-950 mb-2">{children}</Text>
          ),
        }}
      >
        {product.description ? product.description : "-"}
      </Markdown>
    </div>
  )
}

const ProductSpecificationsTab = ({ product }: ProductTabsProps) => {
  const t = useTranslations("Products.tabs")

  return (
    <div className="text-small-regular py-8">
      <Table className="rounded-lg shadow-borders-base overflow-hidden border-none">
        <Table.Body>
          {product.weight && (
            <Table.Row>
              <Table.Cell className="border-r">
                <span className="font-semibold">{t("weightLabel")}</span>
              </Table.Cell>
              <Table.Cell className="px-4">
                {t("weightValue", { weight: product.weight })}
              </Table.Cell>
            </Table.Row>
          )}
          {(product.height || product.width || product.length) && (
            <Table.Row>
              <Table.Cell className="border-r">
                <span className="font-semibold">
                  {t("dimensionsLabel")}
                </span>
              </Table.Cell>
              <Table.Cell className="px-4">
                {t("dimensionsValue", {
                  height: String(product.height),
                  width: String(product.width),
                  length: String(product.length),
                })}
              </Table.Cell>
            </Table.Row>
          )}

          {product.metadata &&
            Object.entries(product.metadata).map(([key, value]) => (
              <Table.Row key={key}>
                <Table.Cell className="border-r">
                  <span className="font-semibold">{key}</span>
                </Table.Cell>
                <Table.Cell className="px-4">
                  <p>{value as string}</p>
                </Table.Cell>
              </Table.Row>
            ))}
        </Table.Body>
      </Table>
    </div>
  )
}

export default ProductTabs
