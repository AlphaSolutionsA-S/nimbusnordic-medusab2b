import { render, screen } from "@testing-library/react"

import MedusaCTA from "@/modules/layout/components/medusa-cta"

describe("MedusaCTA", () => {
  it("TC-1: renders the extracted 'Powered by' label unchanged", async () => {
    const element = await MedusaCTA()
    render(element)

    expect(screen.getByText(/Powered by/)).toBeInTheDocument()
  })
})
