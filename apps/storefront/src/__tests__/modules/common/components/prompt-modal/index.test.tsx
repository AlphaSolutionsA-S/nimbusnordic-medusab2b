import { fireEvent, render, screen } from "@testing-library/react"

import { PromptModal } from "@/modules/common/components/prompt-modal"

describe("PromptModal", () => {
  it("renders the extracted action labels unchanged", () => {
    render(
      <PromptModal
        title="Delete item"
        description="Are you sure?"
        handleAction={() => {}}
        isLoading={false}
      >
        <button>Open</button>
      </PromptModal>
    )

    fireEvent.click(screen.getByRole("button", { name: "Open" }))

    expect(
      screen.getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Continue" })
    ).toBeInTheDocument()
  })
})
