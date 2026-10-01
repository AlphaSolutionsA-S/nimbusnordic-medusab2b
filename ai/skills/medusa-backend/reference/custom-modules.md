# Custom Modules

A module is a reusable package for one domain or integration: data models (tables) plus a service
that manages them. Create one for new domain concepts (brands, wishlists, reviews, loyalty points),
third-party integrations (ERPs, CMSs), or isolated logic that fits no commerce module.

```
src/modules/blog/
├── models/post.ts   # data models
├── service.ts       # service class
└── index.ts         # module definition export
```

## Checklist

Track these in your todo list so migrations aren't missed:

1. Data model in `src/modules/[name]/models/`
2. Service extending `MedusaService`
3. Module definition exported from `index.ts`
4. Register in `medusa-config.ts` — before using the module anywhere or generating migrations
5. `medusa db:generate [module-name]` — never skip
6. `medusa db:migrate` — never skip
7. Use the module service in workflow steps (mutations always go through a workflow; routes may read)
8. Run the build to validate

## 1. Data model

```typescript
// src/modules/blog/models/post.ts
import { model } from "@medusajs/framework/utils"

const Post = model.define("post", {
  id: model.id().primaryKey(),
  title: model.text(),
  content: model.text().nullable(),
  published: model.boolean().default(false),
})
// created_at, updated_at, deleted_at are added automatically — don't declare them
export default Post
```

Property types and relationships: [data-models.md](data-models.md).

## 2. Service

```typescript
// src/modules/blog/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import Post from "./models/post"

class BlogModuleService extends MedusaService({ Post }) {} // auto-generates CRUD per model
export default BlogModuleService
```

Custom methods follow Medusa's service constraints, `data-service-async` and
`data-service-transaction` ([medusa-boundary.md](medusa-boundary.md#module-service-constraints)); a synchronous
public method misbehaves when called through the module. The pattern:

```typescript
import { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"

class BlogModuleService extends MedusaService({ Post }) {
  @InjectManager()
  async publish(id: string, @MedusaContext() sharedContext?: Context) {
    return await this.publish_(id, sharedContext)
  }

  @InjectTransactionManager()
  protected async publish_(id: string, @MedusaContext() sharedContext?: Context) {
    // sharedContext.transactionManager is the open transaction
  }
}
```

## 3. Module definition

```typescript
// src/modules/blog/index.ts
import BlogModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const BLOG_MODULE = "blog"
export default Module(BLOG_MODULE, { service: BlogModuleService })
```

Module names are camelCase (`"blog"`, `"productReview"`, `"orderTracking"`), never kebab-case
(`"product-review"` causes runtime errors): Medusa resolves modules with property-access syntax
(e.g. `container.resolve("productReview")`). The name passed to `Module()` is the container
resolution key.

## 4. Register

```typescript
// medusa-config.ts
module.exports = defineConfig({
  // …
  modules: [{ resolve: "./src/modules/blog" }],
})
```

## 5–6. Migrations

Two separate commands, run right after registering. Without them the tables don't exist and service
methods (`createPosts`, `listPosts`, …) fail at runtime. The usual mistake is using the module in a
workflow or route before migrating.

```bash
medusa db:generate blog   # <module-name>; no description argument
medusa db:migrate         # takes no arguments
```

`medusa db:generate blog "create blog module"` is wrong, as is combining the two.

## Resolving the service

```typescript
import BlogModuleService from "../modules/blog/service"
import { BLOG_MODULE } from "../modules/blog"

const blogService: BlogModuleService = container.resolve(BLOG_MODULE)   // workflow steps
const blogService: BlogModuleService = req.scope.resolve(BLOG_MODULE)   // API routes (reads)
// untyped, a custom module resolves to `unknown` (TS18046) — see type-container-resolve
```

## Auto-generated CRUD methods

```typescript
await blogService.createPosts({ title: "Hello" })            // or an array
await blogService.retrievePost("post_123", { select: ["id", "title"] }) // config optional
await blogService.listPosts({ published: true }, { take: 20, skip: 0, order: { created_at: "DESC" } })
const [posts, count] = await blogService.listAndCountPosts({ published: true })
await blogService.updatePosts({ id: "post_123", title: "Updated" })
await blogService.updatePosts({ selector: { published: false }, data: { published: true } })
await blogService.deletePosts("post_123")                    // or an ID array, or a filter object
await blogService.softDeletePosts("post_123")
await blogService.restorePosts("post_123")
```

## Loaders

Loaders run on application start: initialise connections, seed module data, register resources.

```typescript
// src/modules/blog/loaders/hello-world.ts
import { LoaderOptions, Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function helloWorldLoader({ container }: LoaderOptions) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info("[BLOG MODULE] Started!")
}

// src/modules/blog/index.ts
export default Module("blog", { service: BlogModuleService, loaders: [helloWorldLoader] })
```
