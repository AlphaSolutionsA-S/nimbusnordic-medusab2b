import { render } from "@testing-library/react"

import Bancontact from "@/modules/common/icons/bancontact"
import Ideal from "@/modules/common/icons/ideal"

describe("payment icons", () => {
  it("keeps the brand and translates the icon title (TC-4)", () => {
    const { container: ideal } = render(<Ideal />)
    const { container: bancontact } = render(<Bancontact />)

    expect(ideal.querySelector("title")?.textContent).toBe("iDEAL icon")
    expect(bancontact.querySelector("title")?.textContent).toBe("Bancontact icon")
  })
})
