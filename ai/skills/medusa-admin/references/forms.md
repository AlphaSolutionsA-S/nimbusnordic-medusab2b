# Forms and Modal Patterns

## FocusModal vs Drawer

FocusModal for creating, Drawer for editing.

| FocusModal (create) | Drawer (edit) |
|---------------------|---------------|
| Full-screen modal | Side panel sliding in from the right |
| More space for complex forms, multi-step flows | Quick edits without losing context, single-field updates |

## Edit buttons

Data displayed in a container is not edited in place; open the form from an Edit button — either a top-right icon button or a dropdown of actions.

```tsx
import { PencilSquare, EllipsisHorizontal, Plus, Trash } from "@medusajs/icons"
import { Button, DropdownMenu, Heading, IconButton } from "@medusajs/ui"

<div className="flex items-center justify-between px-6 py-4">
  <Heading level="h2">Section Title</Heading>
  <Button size="small" variant="secondary" onClick={() => setOpen(true)}><PencilSquare /></Button>
</div>

<DropdownMenu>
  <DropdownMenu.Trigger asChild>
    <IconButton size="small" variant="transparent"><EllipsisHorizontal /></IconButton>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item className="gap-x-2"><PencilSquare className="text-ui-fg-subtle" />Edit</DropdownMenu.Item>
    <DropdownMenu.Item className="gap-x-2"><Plus className="text-ui-fg-subtle" />Add</DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item className="gap-x-2"><Trash className="text-ui-fg-subtle" />Delete</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu>
```

## Select (2-10 options)

```tsx
import { Select } from "@medusajs/ui"

<Select>
  <Select.Trigger><Select.Value placeholder="Select status" /></Select.Trigger>
  <Select.Content>
    {items.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
  </Select.Content>
</Select>
```

Larger datasets (products, categories, regions): DataTable in FocusModal with search and pagination — [table-selection.md](table-selection.md).

## FocusModal create form with validation and loading states

```tsx
import { FocusModal, Button, Input, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"

const CreateProductWidget = () => {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ title: "", description: "" })
  const [errors, setErrors] = useState({})
  const queryClient = useQueryClient()

  const createProduct = useMutation({
    mutationFn: (data) => sdk.admin.product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Product created successfully")
      setOpen(false)
      setFormData({ title: "", description: "" }) // clear form after success
      setErrors({})
    },
    onError: (error) => toast.error(error.message || "Failed to create product"),
  })

  const handleSubmit = () => {
    const newErrors = {}
    if (!formData.title) newErrors.title = "Title is required"
    if (!formData.description) newErrors.description = "Description is required"
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return } // validate before submitting
    createProduct.mutate(formData)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Product</Button>
      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <div className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary" disabled={createProduct.isPending}>Cancel</Button>
                </FocusModal.Close>
                <Button size="small" onClick={handleSubmit} isLoading={createProduct.isPending}>Save</Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="flex-1 overflow-auto">
              <div className="flex flex-col gap-y-4">
                <div className="flex flex-col gap-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value })
                      setErrors({ ...errors, title: undefined }) // clear field error on change
                    }}
                  />
                  {errors.title && <Text size="small" className="text-ui-fg-error">{errors.title}</Text>}
                </div>
                {/* … description field, same shape */}
              </div>
            </FocusModal.Body>
          </div>
        </FocusModal.Content>
      </FocusModal>
    </>
  )
}
```

## Drawer edit form

Same state and submit handling; the structure differs, with a title and the buttons in the footer:

```tsx
import { Drawer, Button, Input, Label } from "@medusajs/ui"

<Drawer open={open} onOpenChange={setOpen}>
  <Drawer.Content>
    <Drawer.Header><Drawer.Title>Edit Settings</Drawer.Title></Drawer.Header>
    <Drawer.Body className="flex-1 overflow-auto p-4">
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <Label>Title</Label>
          <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
        </div>
      </div>
    </Drawer.Body>
    <Drawer.Footer>
      <div className="flex items-center justify-end gap-x-2">
        <Drawer.Close asChild><Button size="small" variant="secondary">Cancel</Button></Drawer.Close>
        <Button size="small" onClick={handleSubmit}>Save</Button>
      </div>
    </Drawer.Footer>
  </Drawer.Content>
</Drawer>
```

Initialize edit state from the entity: `useState({ title: data.title })`.

## Form rules

- Disable actions during mutations: `disabled={mutation.isPending}`.
- Show loading on the submit button: `isLoading={mutation.isPending}`.
- On success: reset form data to its initial state, clear errors, close the modal.
- Validate before submitting; clear a field's error when its input changes.
