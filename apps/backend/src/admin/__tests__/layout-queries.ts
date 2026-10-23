// Queries over the attributes the `dashboard-components.tsx` stand-in renders, so page tests share
// one reading of them.

export function layoutEntry(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-layout-entry="${id}"]`);
  if (!element) throw new Error(`no layout entry "${id}"`);
  return element;
}

export function layoutEntryIds(container: Element): (string | null)[] {
  return Array.from(container.querySelectorAll("[data-layout-entry]")).map((el) =>
    el.getAttribute("data-layout-entry")
  );
}

export function layoutSection(layout: HTMLElement, name: "main" | "side"): Element {
  const element = layout.querySelector(`[data-layout-section="${name}"]`);
  if (!element) throw new Error(`no layout section "${name}"`);
  return element;
}
