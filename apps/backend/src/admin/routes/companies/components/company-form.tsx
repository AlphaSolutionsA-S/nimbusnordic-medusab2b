import { Button, Drawer, Input, Label, Select, Text } from "@medusajs/ui";
import { AdminUpdateCompany } from "../../../../types";
import { useState } from "react";
import { useRegions } from "../../../hooks/api";
import { BLOCKED_STATE_LABELS } from "../bc-managed-fields";
import { BcManagedIndicator } from "./bc-managed-indicator";

export function CompanyForm({
  company,
  handleSubmit,
  loading,
  error,
}: {
  company?: AdminUpdateCompany;
  handleSubmit: (data: AdminUpdateCompany) => Promise<void>;
  loading: boolean;
  error: Error | null;
}) {
  const [formData, setFormData] = useState<AdminUpdateCompany>(
    company || ({} as AdminUpdateCompany)
  );

  const { regions, isPending: regionsLoading } = useRegions();

  const currencyCodes = regions?.map((region) => region.currency_code);
  const countries = regions?.flatMap((region) => region.countries);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCurrencyChange = (value: string) => {
    setFormData({ ...formData, currency_code: value });
  };

  const handleCountryChange = (value: string) => {
    setFormData({ ...formData, country: value });
  };

  const handleBlockedChange = (value: string) => {
    setFormData({
      ...formData,
      blocked: value as AdminUpdateCompany["blocked"],
    });
  };

  const handleCreditLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData({
      ...formData,
      credit_limit: value === "" ? null : Number(value),
    });
  };

  return (
    <form>
      <Drawer.Body className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Label size="xsmall">Company Name</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Medusa"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">Company Phone</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="1234567890"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">Company Email</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="medusa@medusa.com"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">Company Address</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="text"
            name="address"
            value={formData.address || ""}
            onChange={handleChange}
            placeholder="1234 Main St"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">Company City</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="text"
            name="city"
            value={formData.city || ""}
            onChange={handleChange}
            placeholder="New York"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">Company State</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="text"
            name="state"
            value={formData.state || ""}
            onChange={handleChange}
            placeholder="NY"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">Company Zip</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="text"
            name="zip"
            value={formData.zip || ""}
            onChange={handleChange}
            placeholder="10001"
          />
          <div className="flex gap-4 w-full">
            <div className="flex flex-col gap-2 w-1/2">
              <div className="flex items-center gap-2">
                <Label size="xsmall">Company Country</Label>
                <BcManagedIndicator />
              </div>
              <Select
                name="country"
                value={formData.country || ""}
                onValueChange={handleCountryChange}
                disabled={regionsLoading}
              >
                <Select.Trigger disabled={regionsLoading}>
                  <Select.Value placeholder="Select a country" />
                </Select.Trigger>
                <Select.Content className="z-50">
                  {countries?.map((country) => (
                    <Select.Item
                      key={country?.iso_2 || ""}
                      value={country?.iso_2 || ""}
                    >
                      {country?.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-2 w-1/2">
              <div className="flex items-center gap-2">
                <Label size="xsmall">Currency</Label>
                <BcManagedIndicator />
              </div>

              <Select
                name="currency_code"
                value={formData.currency_code || ""}
                onValueChange={handleCurrencyChange}
                defaultValue={currencyCodes?.[0]}
                disabled={regionsLoading}
              >
                <Select.Trigger disabled={regionsLoading}>
                  <Select.Value placeholder="Select a currency" />
                </Select.Trigger>

                <Select.Content className="z-50">
                  {currencyCodes?.map((currencyCode) => (
                    <Select.Item key={currencyCode} value={currencyCode}>
                      {currencyCode.toUpperCase()}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </div>
          {/* TODO: Add logo upload */}
          <Label size="xsmall">Company Logo URL</Label>
          <Input
            type="text"
            name="logo_url"
            value={formData.logo_url || ""}
            onChange={handleChange}
            placeholder="https://example.com/logo.png"
          />
          <Label size="xsmall">Business Central Customer Number</Label>
          <Input
            type="text"
            name="business_central_customer_number"
            value={formData.business_central_customer_number || ""}
            onChange={handleChange}
            placeholder="123456"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">Blocked</Label>
            <BcManagedIndicator />
          </div>
          <Select
            name="blocked"
            value={formData.blocked || "not_blocked"}
            onValueChange={handleBlockedChange}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content className="z-50">
              {Object.entries(BLOCKED_STATE_LABELS).map(([value, label]) => (
                <Select.Item key={value} value={value}>
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <div className="flex items-center gap-2">
            <Label size="xsmall">Credit Limit</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="number"
            step="0.01"
            name="credit_limit"
            value={formData.credit_limit ?? ""}
            onChange={handleCreditLimitChange}
            placeholder="10000.00"
          />
          <div className="flex items-center gap-2">
            <Label size="xsmall">VAT Number</Label>
            <BcManagedIndicator />
          </div>
          <Input
            type="text"
            name="vat_number"
            value={formData.vat_number || ""}
            onChange={handleChange}
            placeholder="DK12345678"
          />
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close asChild>
          <Button variant="secondary">Cancel</Button>
        </Drawer.Close>
        <Button
          isLoading={loading}
          onClick={async () => await handleSubmit(formData)}
        >
          Save
        </Button>
        {error && (
          <Text className="txt-compact-small text-ui-fg-warning">
            Error: {error?.message}
          </Text>
        )}
      </Drawer.Footer>
    </form>
  );
}
