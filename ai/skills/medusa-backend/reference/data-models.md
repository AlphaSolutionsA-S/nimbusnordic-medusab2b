# Data Models

Data models are database tables, defined with Medusa's Data Model Language (DML).

```typescript
import { model } from "@medusajs/framework/utils"

const MyModel = model.define("my_model", {
  id: model.id().primaryKey(),                    // required
  name: model.text(),
  quantity: model.number(),
  price: model.bigNumber(),                       // high precision
  is_active: model.boolean().default(true),
  status: model.enum(["draft", "published", "archived"]).default("draft"),
  published_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),              // flexible data
  tags: model.array().nullable(),
})
```

Modifiers: properties are required by default; `.nullable()`, `.default(value)`, `.unique()`,
`.primaryKey()`.

`created_at`, `updated_at` and `deleted_at` (soft delete) are added automatically; never declare them.

## Relationships within a module

`hasMany` (one-to-many), `belongsTo` (many-to-one), `hasOne` (one-to-one), `manyToMany`. Across
modules, use [module links](module-links.md).

```typescript
// src/modules/blog/models/post.ts
import { Comment } from "./comment"
export const Post = model.define("post", {
  id: model.id().primaryKey(),
  title: model.text(),
  comments: model.hasMany(() => Comment, { mappedBy: "post" }),
})

// src/modules/blog/models/comment.ts
import { Post } from "./post"
export const Comment = model.define("comment", {
  id: model.id().primaryKey(),
  content: model.text(),
  post: model.belongsTo(() => Post, { mappedBy: "comments" }),
})
```

## Migrations after changes

After any model change (e.g. adding a property), generate before running:

```bash
medusa db:generate blog
medusa db:migrate
```
