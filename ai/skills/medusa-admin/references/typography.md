# Typography Guidelines

Use `Text` from `@medusajs/ui` for all text, always with `size="small"` and `leading="compact"`.

| Use case | Pattern |
|----------|---------|
| Section headings, field labels, primary text | `<Text size="small" leading="compact" weight="plus">` |
| Descriptions, helper text, metadata, empty states | `<Text size="small" leading="compact" className="text-ui-fg-subtle">` |
| Errors | `<Text size="small" className="text-ui-fg-error">` |
| Large headings (page titles, container headers) | `<Heading>` component |

Never use `<Heading>` for small sections inside widgets/containers.

## Examples

```tsx
// Label + description (widget section, list item title/subtitle, form field label above <Input />)
<div className="flex flex-col gap-y-2">   {/* gap-y-1 for list items */}
  <Text size="small" leading="compact" weight="plus">Product Settings</Text>
  <Text size="small" leading="compact" className="text-ui-fg-subtle">
    Configure how this product appears in your store
  </Text>
</div>

// Container header
<Container className="divide-y p-0">
  <div className="flex items-center justify-between px-6 py-4">
    <Heading level="h2">Related Products</Heading>
  </div>
</Container>

// Label-value pair: inline in `flex items-center gap-x-2`, or stacked in `flex flex-col gap-y-1`
// cells of a `grid grid-cols-2 gap-4`. Label subtle, value weight="plus".
// Exception, badge/status text ("Status: Active"): label weight="plus", value subtle.
<div className="flex items-center gap-x-2">
  <Text size="small" leading="compact" className="text-ui-fg-subtle">SKU:</Text>
  <Text size="small" leading="compact" weight="plus">SHIRT-001</Text>
</div>

// Card metadata row: put text-ui-fg-subtle on the wrapper
<div className="flex items-center gap-x-2 text-ui-fg-subtle">
  <Text size="small" leading="compact">$29.99</Text>
  <Text size="small" leading="compact">•</Text>
  <Text size="small" leading="compact">In stock</Text>
</div>
```

## Text color classes

| Class | Use |
|-------|-----|
| `text-ui-fg-base` | Default (rarely needed) |
| `text-ui-fg-subtle` | Secondary/muted |
| `text-ui-fg-muted` | More muted |
| `text-ui-fg-disabled` | Disabled |
| `text-ui-fg-error` / `-success` / `-warning` | Error / success / warning messages |
