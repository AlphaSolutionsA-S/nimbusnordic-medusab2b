import type { ReactNode } from "react";

// Jest stand-in for `@medusajs/dashboard/components` (mapped in `jest.admin.config.js`): the real
// package cannot load under jsdom and needs the dashboard's own providers. It renders each section
// in default order (main, then side) and exposes the page key, layout id and entry ids as data
// attributes. It ignores `data` and widgets and asserts nothing about Medusa's edit mode or saving.

type StandInLayoutComposerProps = {
  widgetsZonePrefix: string;
  preferredLayoutId: string;
  sections: Partial<Record<string, ReactNode>>;
  data?: unknown;
  hasOutlet?: boolean;
  disableWidgets?: boolean;
};

const SECTION_ORDER = ["main", "side"];

function LayoutEntry({ id, children }: { id: string; children: ReactNode }) {
  return <div data-layout-entry={id}>{children}</div>;
}

function StandInLayoutComposer({
  widgetsZonePrefix,
  preferredLayoutId,
  sections,
}: StandInLayoutComposerProps) {
  return (
    <div
      data-testid="layout-composer"
      data-page-key={widgetsZonePrefix}
      data-layout-id={preferredLayoutId}
    >
      {SECTION_ORDER.filter((name) => name in sections).map((name) => (
        <div key={name} data-layout-section={name}>
          {sections[name]}
        </div>
      ))}
    </div>
  );
}

export const LayoutComposer = Object.assign(StandInLayoutComposer, {
  Entry: LayoutEntry,
});
