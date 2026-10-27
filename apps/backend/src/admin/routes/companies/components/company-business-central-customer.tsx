import { Spinner } from "@medusajs/icons";
import {
  Alert,
  Button,
  Container,
  Heading,
  Prompt,
  Table,
  Text,
  toast,
} from "@medusajs/ui";
import { useState } from "react";
import type {
  AdminBusinessCentralCustomerLookupResult,
  AdminBusinessCentralCustomerResponse,
  AdminUseBusinessCentralCustomerResponse,
  QueryCompany,
} from "../../../../types";
import {
  useBusinessCentralCustomer,
  useBusinessCentralCustomerLookup,
  useUseBusinessCentralCustomer,
} from "../../../hooks/api";

type Environment = AdminBusinessCentralCustomerResponse["routed_environment"];
type FoundResult = AdminBusinessCentralCustomerLookupResult & {
  customer: NonNullable<AdminBusinessCentralCustomerLookupResult["customer"]>;
};

const ENVIRONMENT_NAMES: Record<Environment, string> = { DK: "Denmark", NO: "Norway" };
const environmentLabel = (environment: Environment) =>
  `${ENVIRONMENT_NAMES[environment]} (${environment})`;

const USE_OUTCOME_TOASTS: Record<
  AdminUseBusinessCentralCustomerResponse["status"],
  (country: string) => void
> = {
  updated: (country) =>
    toast.success("Business Central customer set", {
      description: `Country set to ${country} and the company synced from Business Central.`,
    }),
  skipped: (country) =>
    toast.info("Country set, but nothing was synced", {
      description: `Country set to ${country}. Business Central has no customer with this number in the environment that country routes to.`,
    }),
  failed: (country) =>
    toast.error("Country set, but the Business Central sync failed", {
      description: `Country set to ${country}. Business Central could not be reached or returned an error, so nothing else was changed.`,
    }),
};

const isFound = (result: AdminBusinessCentralCustomerLookupResult): result is FoundResult =>
  result.status === "found" && result.customer !== null;

export const CompanyBusinessCentralCustomer = ({ company }: { company: QueryCompany }) => {
  const customerNumber = company.business_central_customer_number;
  const status = useBusinessCentralCustomer(company.id);
  const lookup = useBusinessCentralCustomerLookup(company.id, customerNumber);
  const use = useUseBusinessCentralCustomer(company.id);
  const [confirming, setConfirming] = useState<FoundResult | null>(null);

  const results = lookup.data?.results ?? [];
  const foundNowhere = results.length > 0 && results.every((r) => r.status === "not_found");

  const submit = (environment: Environment) => {
    use.mutate(
      { environment },
      {
        onSuccess: ({ status: outcome, country }) => USE_OUTCOME_TOASTS[outcome](country),
        onError: (error) =>
          error.status === 404
            ? toast.error(`Business Central no longer has this customer in ${environment}`, {
                description: "Nothing was changed. Check the customer number again.",
              })
            : toast.error("Could not use this customer", {
                description: "Something went wrong. Try again later.",
              }),
      }
    );
  };

  const choose = (result: FoundResult) => {
    if (result.customer.routes_elsewhere) {
      setConfirming(result);
    } else {
      submit(result.environment);
    }
  };

  const confirm = () => {
    if (confirming) submit(confirming.environment);
    setConfirming(null);
  };

  return (
    <>
      <Container className="flex flex-col p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 justify-between">
          <Heading className="font-sans font-medium h1-core">Business Central customer</Heading>
          <Button
            size="small"
            variant="secondary"
            disabled={!customerNumber || lookup.isFetching}
            isLoading={lookup.isFetching}
            onClick={() => {
              void lookup.refetch();
            }}
          >
            Check customer number in DK and NO
          </Button>
        </div>
        {status.isPending && (
          <div className="px-6 py-4">
            <Text size="small" role="status">
              <Spinner className="inline animate-spin" /> Loading Business Central customer
            </Text>
          </div>
        )}
        {status.isError && (
          <div className="px-6 py-4">
            <Alert variant="error">
              <Text size="small">Could not load the Business Central customer status.</Text>
            </Alert>
          </div>
        )}
        {status.data && (
          <Table>
            <Table.Body>
              <Table.Row>
                <Table.Cell className="font-medium font-sans txt-compact-small">
                  Routed environment
                </Table.Cell>
                <Table.Cell>{environmentLabel(status.data.routed_environment)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell className="font-medium font-sans txt-compact-small">
                  Customer not found
                </Table.Cell>
                <Table.Cell>
                  {status.data.not_found
                    ? `${status.data.not_found.customer_number} in ${environmentLabel(
                        status.data.not_found.environment
                      )}, ${new Date(status.data.not_found.at).toLocaleString()}`
                    : "None"}
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        )}
        {!customerNumber && (
          <div className="px-6 py-4">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Add a Business Central customer number to check it.
            </Text>
          </div>
        )}
        {lookup.isError && (
          <div className="px-6 py-4">
            <Alert variant="error">
              <Text size="small">Could not check the customer number. Try again.</Text>
            </Alert>
          </div>
        )}
        {results.length > 0 && (
          <div className="flex flex-col gap-3 px-6 py-4 border-t border-gray-200">
            {foundNowhere && (
              <Text size="small" leading="compact">
                {`Business Central has no customer ${lookup.data?.customer_number} in DK or NO.`}
              </Text>
            )}
            {results.map((result) => (
              <div
                key={result.environment}
                role="group"
                aria-label={`Business Central ${result.environment}`}
                className="flex flex-col gap-2"
              >
                <Text size="small" leading="compact" weight="plus">
                  {environmentLabel(result.environment)}
                </Text>
                {isFound(result) ? (
                  <>
                    <Text size="small" leading="compact">
                      {`${result.customer.name}, country ${result.customer.country}`}
                    </Text>
                    {result.customer.routes_elsewhere && (
                      <Alert variant="warning">
                        <Text size="small">
                          {`This card's country ${result.customer.country} routes the company to ${result.customer.routes_to}, not ${result.environment}.`}
                        </Text>
                      </Alert>
                    )}
                    <div>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={use.isPending}
                        onClick={() => choose(result)}
                      >
                        Use this customer
                      </Button>
                    </div>
                  </>
                ) : (
                  <Text size="small" leading="compact" className="text-ui-fg-subtle">
                    {result.status === "not_found" ? "Not found" : "Could not check"}
                  </Text>
                )}
              </div>
            ))}
          </div>
        )}
      </Container>
      <Prompt
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Use this customer?</Prompt.Title>
            <Prompt.Description>
              {confirming &&
                `The card in ${confirming.environment} has country ${confirming.customer.country}, which routes the company to ${confirming.customer.routes_to}. Order history, returns and the sync will use ${confirming.customer.routes_to} until the country is corrected in Business Central.`}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancel</Prompt.Cancel>
            <Prompt.Action onClick={confirm}>Use this customer</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </>
  );
};
