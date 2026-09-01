import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("@/lib/data/cart", () => ({
  updateLineItem: jest.fn(),
}))

import AddNoteButton from "@/modules/cart/components/add-note-button"

const item = {
  id: "item-1",
  quantity: 1,
  metadata: {},
} as unknown as HttpTypes.StoreCartLineItem

describe("AddNoteButton", () => {
  it("renders the extracted 'Add note' label unchanged", () => {
    render(<AddNoteButton item={item} />)

    expect(screen.getByText("Add note")).toBeInTheDocument()
  })

  it("renders the extracted 'Note:' label unchanged when a note exists", () => {
    const itemWithNote = {
      ...item,
      metadata: { note: "Fragile" },
    } as unknown as HttpTypes.StoreCartLineItem

    render(<AddNoteButton item={itemWithNote} />)

    expect(screen.getAllByText("Note:").length).toBeGreaterThan(0)
    expect(screen.getByText("Fragile")).toBeInTheDocument()
  })
})
