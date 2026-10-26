import { getBcOrderLineDisplay } from "@/lib/util/bc-order-line-display"

describe("getBcOrderLineDisplay", () => {
  it("hides a description equal to the name, trimmed and case-insensitive", () => {
    expect(
      getBcOrderLineDisplay({
        itemDisplayName: "Franklin Unisex - Grey Melange",
        description: "  franklin unisex - GREY melange ",
        variantCode: "XL",
      })
    ).toEqual({ name: "Franklin Unisex - Grey Melange", size: "XL" })
  })

  it("hides a description equal to the size, trimmed and case-insensitive", () => {
    expect(
      getBcOrderLineDisplay({
        itemDisplayName: "Camden Men - Midnight Blue",
        description: " m ",
        variantCode: "M",
      })
    ).toEqual({ name: "Camden Men - Midnight Blue", size: "M" })
  })

  it("keeps a description that differs from both the name and the size", () => {
    expect(
      getBcOrderLineDisplay({
        itemDisplayName: "Camden Men",
        description: "Embroidered logo",
        variantCode: "M",
      })
    ).toEqual({
      name: "Camden Men",
      description: "Embroidered logo",
      size: "M",
    })
  })

  it("hides an empty description and has no size without a variant code", () => {
    expect(
      getBcOrderLineDisplay({ itemDisplayName: "Widget", description: "  " })
    ).toEqual({ name: "Widget" })
  })

  it("has no size for a blank variant code", () => {
    expect(
      getBcOrderLineDisplay({ itemDisplayName: "Widget", description: "", variantCode: " " })
    ).toEqual({ name: "Widget" })
  })

  it("falls back to the description for the name without repeating it", () => {
    expect(
      getBcOrderLineDisplay({ description: "Loose part", itemNumber: "1000" })
    ).toEqual({ name: "Loose part" })
  })

  it("falls back to the item number for the name", () => {
    expect(getBcOrderLineDisplay({ description: "", itemNumber: "1000" })).toEqual({
      name: "1000",
    })
  })

  it("has no name when the line has no display name, description or item number", () => {
    expect(getBcOrderLineDisplay({ description: "" })).toEqual({})
  })
})
