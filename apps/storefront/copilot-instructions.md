# Storefront — Copilot Instructions

## Tech Stack

- **Next.js 15** (App Router, React 19, Server Components by default)
- **Medusa JS SDK** (`@medusajs/js-sdk`, `@medusajs/types`) — headless commerce
- **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives)
- **Jest** + **React Testing Library** — testing

## Project Structure

```
src/
  app/                    # App Router — layouts, pages, API routes
  lib/                    # Config, utilities, Sitecore client
    context/              # React context providers
    data/                 # Medusa data fetching layer (cart, products, orders…)
    hooks/                # Custom React hooks
    util/                 # Shared utilities
  modules/                # All UI components for storefront
  types/                  # Shared TypeScript types
  __tests__/              # Tests (mirrors component folder structure)
  __mocks__/              # Jest mocks (component-map)
```

## Naming Conventions

- **Directories:** kebab-case (`accordion-block/`, `global-header/`)
- **Component files:** PascalCase (`Hero.tsx`, `HeroDefault.dev.tsx`)
- **Props/types files:** kebab-case (`hero.props.ts`, `hero.dictionary.ts`)
- **Variables/functions:** camelCase
- **Types/interfaces:** PascalCase
- **Constants:** UPPER_SNAKE_CASE

## Core Patterns


### Server vs Client Components

- **Server Components** are the default — use for static content and data fetching
- Add `'use client'` only when interactivity is needed (state, effects, event handlers)
- Keep client components focused; pass server-fetched data as props


### Routing


## Key Rules

- No `any` — use proper types or type assertions 
- Do not fetch layout or catalog data inside child components — fetch at the route level and pass as props
- Always create a test file when implementing a new component
