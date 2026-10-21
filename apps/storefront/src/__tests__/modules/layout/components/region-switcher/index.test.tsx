import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useParams } from "next/navigation"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "gb" })),
}))
jest.mock("@/lib/data/ui-translations-refresh", () => ({
  refreshUiTranslationsForCountry: jest.fn(() => Promise.resolve()),
}))

import { refreshUiTranslationsForCountry } from "@/lib/data/ui-translations-refresh"

import CountrySelect from "@/modules/checkout/components/country-select"
import { RegionSwitcher, RegionSwitcherOption } from "@/modules/layout/components/region-switcher"

// The 8 regions targeted by NIMBUS-166/scope.md, with the languages the country-language
// publication supplies for them (NIMBUS-176).
const options: RegionSwitcherOption[] = [
  { countryCode: "dk", countryName: "Denmark", locale: "da" },
  { countryCode: "gb", countryName: "United Kingdom", locale: "en" },
  { countryCode: "se", countryName: "Sweden", locale: "sv" },
  { countryCode: "no", countryName: "Norway", locale: "no" },
  { countryCode: "pl", countryName: "Poland", locale: "pl" },
  { countryCode: "it", countryName: "Italy", locale: "it" },
  { countryCode: "fr", countryName: "France", locale: "fr" },
  { countryCode: "de", countryName: "Germany", locale: "de" },
]

describe("RegionSwitcher", () => {
  const originalLocation = window.location

  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ countryCode: "gb" })
    ;(refreshUiTranslationsForCountry as jest.Mock).mockClear()
    // `window.location.href` is reassigned (not `router.push`) so the
    // navigation re-triggers middleware.ts — jsdom doesn't implement real
    // navigation, so location is replaced with a writable stand-in per test.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
  })

  it("TC-1: renders all 8 target regions with their language shown", () => {
    render(<RegionSwitcher options={options} />)

    expect(
      screen.getByRole("option", { name: "Denmark (da)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "United Kingdom (en)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Sweden (sv)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Norway (no)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Poland (pl)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Italy (it)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "France (fr)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Germany (de)" })
    ).toBeInTheDocument()
  })

  it("shows the language supplied in its props, including a ninth language and a changed one", () => {
    render(
      <RegionSwitcher
        options={[
          ...options.filter((option) => option.countryCode !== "dk"),
          { countryCode: "dk", countryName: "Denmark", locale: "en" },
          { countryCode: "nl", countryName: "Netherlands", locale: "nl" },
        ]}
      />
    )

    expect(screen.getByRole("option", { name: "Netherlands (nl)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Denmark (en)" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Denmark (da)" })).toBeNull()
  })

  it("navigates to a ninth-language country by its code, refreshing that country's texts", async () => {
    render(
      <RegionSwitcher options={[...options, { countryCode: "nl", countryName: "Netherlands", locale: "nl" }]} />
    )

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "nl" } })

    expect(refreshUiTranslationsForCountry).toHaveBeenCalledWith("nl")
    await waitFor(() => expect(window.location.href).toBe("/nl"))
  })

  it("TC-2: selecting a different region redirects to that region's homepage", async () => {
    render(<RegionSwitcher options={options} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "dk" } })

    await waitFor(() => expect(window.location.href).toBe("/dk"))
  })

  it("TC-3: re-selecting the currently-active region is a no-op", () => {
    render(<RegionSwitcher options={options} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gb" } })

    expect(window.location.href).toBe("")
    expect(refreshUiTranslationsForCountry).not.toHaveBeenCalled()
  })

  it("TC-5: refreshes the new language's texts before navigating", async () => {
    let finishRefresh: () => void = () => {}
    ;(refreshUiTranslationsForCountry as jest.Mock).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishRefresh = resolve
      })
    )
    render(<RegionSwitcher options={options} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "de" } })

    expect(refreshUiTranslationsForCountry).toHaveBeenCalledWith("de")
    expect(window.location.href).toBe("")
    finishRefresh()
    await waitFor(() => expect(window.location.href).toBe("/de"))
  })

  it("TC-6: still navigates when the refresh fails", async () => {
    ;(refreshUiTranslationsForCountry as jest.Mock).mockReturnValueOnce(
      Promise.reject(new Error("offline"))
    )
    render(<RegionSwitcher options={options} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "se" } })

    await waitFor(() => expect(window.location.href).toBe("/se"))
  })

  it("TC-4: is a distinct control from the checkout country-select", () => {
    const { container } = render(
      <>
        <RegionSwitcher options={options} />
        <CountrySelect name="country_code" onChange={() => {}} />
      </>
    )

    const selects = container.querySelectorAll("select")
    expect(selects).toHaveLength(2)

    const [regionSwitcherSelect, countrySelectSelect] = Array.from(selects)
    expect(regionSwitcherSelect).not.toBe(countrySelectSelect)
    expect(regionSwitcherSelect).toHaveAttribute(
      "aria-label",
      "Select your region"
    )
    expect(countrySelectSelect).not.toHaveAttribute(
      "aria-label",
      "Select your region"
    )
  })

  // Task 02: mobile layout check.
  it("TC-1 (Task 02): is not opted out of mobile visibility via the app's responsive 'hidden' convention", () => {
    // This header hides elements at narrow viewports with Tailwind's
    // `hidden small:*` pattern (e.g. the search input in nav/index.tsx).
    // jsdom performs no CSS layout, so this checks the component isn't
    // marked with that same opt-out class, rather than asserting real pixel
    // layout — see PROGRESS.md for the manual mobile QA follow-up.
    const { container } = render(<RegionSwitcher options={options} />)

    const select = screen.getByRole("combobox")
    expect(select.closest("div.relative")).not.toHaveClass("hidden")
    expect(container.querySelector(".hidden")).toBeNull()
  })

  // Task 02: conflict check against the checkout country-select.
  it("TC-2 (Task 02): its distinguishing classes don't leak onto the checkout country-select", () => {
    const { container } = render(
      <>
        <RegionSwitcher options={options} />
        <CountrySelect name="country_code" onChange={() => {}} />
      </>
    )

    const countrySelect = container.querySelector('select[name="country_code"]')
    expect(countrySelect?.closest("div.relative")?.className).not.toMatch(
      /max-w-\[10rem\]/
    )
  })
})
