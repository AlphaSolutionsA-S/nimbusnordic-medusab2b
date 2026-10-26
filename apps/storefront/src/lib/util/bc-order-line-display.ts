import type { BCOrderLine } from "@/types/bc-order"

export type BcOrderLineDisplay = {
  readonly name?: string
  readonly description?: string
  readonly size?: string
}

const present = (value: string | undefined): string | undefined =>
  value?.trim() || undefined

const sameText = (a: string, b: string | undefined): boolean =>
  b !== undefined && a.toLowerCase() === b.toLowerCase()

// The size is the BC variant code (NIMBUS-255); BC repeats the product name or the size in the
// line description, so the description is shown only when it adds something.
export function getBcOrderLineDisplay(
  line: Pick<BCOrderLine, "itemDisplayName" | "description" | "itemNumber" | "variantCode">
): BcOrderLineDisplay {
  const description = present(line.description)
  const name = present(line.itemDisplayName) ?? description ?? present(line.itemNumber)
  const size = present(line.variantCode)
  const extraDescription =
    description && !sameText(description, name) && !sameText(description, size)
      ? description
      : undefined

  return {
    ...(name && { name }),
    ...(extraDescription && { description: extraDescription }),
    ...(size && { size }),
  }
}
