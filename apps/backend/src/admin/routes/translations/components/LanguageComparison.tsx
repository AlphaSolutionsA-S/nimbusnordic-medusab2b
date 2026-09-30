import { Text } from "@medusajs/ui";
import { compareMissing, flattenMessages } from "../../../../utils/translations/documents";
import type { MessageDocument } from "../../../../types/storefront-translation";

export interface LanguageComparisonProps {
  current: MessageDocument;
  reference: MessageDocument | null;
}

const MAX_ROWS = 500;

/** Read-only: texts that are missing or blank in the current language compared with the reference. */
export function LanguageComparison({ current, reference }: LanguageComparisonProps) {
  if (!reference) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        The reference language is not available, so there is nothing to compare with.
      </Text>
    );
  }
  const missing = compareMissing(current, reference);
  const currentValues = flattenMessages(current);
  const referenceValues = flattenMessages(reference);
  if (!missing.length) {
    return <Text size="small">No texts are missing or empty compared with the reference.</Text>;
  }
  return (
    <div className="flex flex-col gap-y-2">
      <Text size="small" weight="plus">
        {missing.length} text{missing.length === 1 ? " is" : "s are"} missing or empty
      </Text>
      <ul aria-label="Missing or empty texts" className="flex max-h-[60vh] flex-col gap-y-2 overflow-y-auto">
        {missing.slice(0, MAX_ROWS).map((key) => (
          <li key={key} className="flex flex-col rounded-md border border-ui-border-base px-3 py-2">
            <Text size="small" className="font-mono">
              {key}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {Object.prototype.hasOwnProperty.call(currentValues, key) ? "Empty" : "Missing"} · Reference: {referenceValues[key]}
            </Text>
          </li>
        ))}
      </ul>
    </div>
  );
}
