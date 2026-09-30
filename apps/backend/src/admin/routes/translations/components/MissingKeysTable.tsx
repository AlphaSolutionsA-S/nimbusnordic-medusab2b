import { useState } from "react";
import { Button, Input, Table, Text } from "@medusajs/ui";
import {
  MISSING_PAGE_SIZE,
  useDismissMissing,
  useMissingTranslations,
  useResolveMissing,
} from "../../../hooks/api/ui-translations";
import { safeErrorMessage } from "../../../lib/translations";
import type { MissingKeyRecord, TranslationDocument } from "../../../../types/storefront-translation";

export interface MissingKeysTableProps {
  locale?: string;
  document: TranslationDocument | null;
  onResolved: (document: TranslationDocument) => void;
}

const LOCALE_UNAVAILABLE_KEY = "__locale_unavailable__";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function MissingRow({
  record,
  document,
  showLocale,
  onResolved,
}: {
  record: MissingKeyRecord;
  document: TranslationDocument | null;
  showLocale: boolean;
  onResolved: (document: TranslationDocument) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolve = useResolveMissing(record.locale);
  const dismiss = useDismissMissing(record.locale);
  const outage = record.key === LOCALE_UNAVAILABLE_KEY;
  const canResolve = !outage && document?.locale === record.locale;

  const submit = () => {
    if (!document || !value.trim()) {
      return;
    }
    setError(null);
    resolve.mutate(
      { id: record.id, expected_version: document.version, value },
      {
        onSuccess: (result) => onResolved(result.translation),
        onError: (resolveError) => setError(safeErrorMessage(resolveError)),
      }
    );
  };

  return (
    <Table.Row>
      {showLocale && <Table.Cell>{record.locale}</Table.Cell>}
      <Table.Cell>
        {outage ? (
          <div className="flex flex-col">
            <Text size="small" weight="plus">
              Language unavailable on the storefront
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Import or activate {record.locale} to fix this. It is not a text you can fill in.
            </Text>
          </div>
        ) : (
          <Text size="small" className="font-mono">
            {record.key}
          </Text>
        )}
      </Table.Cell>
      <Table.Cell>{record.count}</Table.Cell>
      <Table.Cell>
        <Text size="xsmall">First: {formatDate(record.first_seen_at)}</Text>
        <Text size="xsmall">Last: {formatDate(record.last_seen_at)}</Text>
      </Table.Cell>
      <Table.Cell>
        <Text size="xsmall" className="font-mono">
          {record.last_page_path}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col gap-y-1">
          {canResolve && (
            <div className="flex gap-x-2">
              <Input
                size="small"
                aria-label={`Text for ${record.key}`}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
              <Button
                size="small"
                onClick={submit}
                disabled={!value.trim() || resolve.isPending}
                isLoading={resolve.isPending}
              >
                Add text
              </Button>
            </div>
          )}
          {!outage && !canResolve && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Open {record.locale} to add this text.
            </Text>
          )}
          <div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => dismiss.mutate(record.id, { onError: (e) => setError(safeErrorMessage(e)) })}
              disabled={dismiss.isPending}
            >
              Dismiss
            </Button>
          </div>
          {error && (
            <Text role="alert" size="xsmall" className="text-ui-fg-error">
              {error}
            </Text>
          )}
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

export function MissingKeysTable({ locale, document, onResolved }: MissingKeysTableProps) {
  const [offset, setOffset] = useState(0);
  const missing = useMissingTranslations(locale, offset);
  const showLocale = !locale;

  if (missing.isPending) {
    return (
      <Text role="status" size="small">
        Loading missing texts…
      </Text>
    );
  }
  if (missing.isError) {
    return (
      <div className="flex flex-col items-start gap-y-2">
        <Text size="small">Missing texts could not be loaded.</Text>
        <Button size="small" variant="secondary" onClick={() => missing.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  const { missing_keys: rows, count } = missing.data;
  if (!rows.length) {
    return <Text size="small">No missing texts have been reported.</Text>;
  }
  return (
    <div className="flex flex-col gap-y-2">
      <Table>
        <Table.Header>
          <Table.Row>
            {showLocale && <Table.HeaderCell>Language</Table.HeaderCell>}
            <Table.HeaderCell>Key</Table.HeaderCell>
            <Table.HeaderCell>Reports</Table.HeaderCell>
            <Table.HeaderCell>Seen</Table.HeaderCell>
            <Table.HeaderCell>Last page</Table.HeaderCell>
            <Table.HeaderCell>Action</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((record) => (
            <MissingRow
              key={record.id}
              record={record}
              document={document}
              showLocale={showLocale}
              onResolved={onResolved}
            />
          ))}
        </Table.Body>
      </Table>
      <div className="flex items-center justify-between">
        <Text size="xsmall" className="text-ui-fg-subtle">
          {offset + 1}–{offset + rows.length} of {count}
        </Text>
        <div className="flex gap-x-2">
          <Button
            size="small"
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - MISSING_PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={offset + rows.length >= count}
            onClick={() => setOffset(offset + MISSING_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
