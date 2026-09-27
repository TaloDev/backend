---
name: new-route
description: Create a new backend route following project conventions
---

# Create a New Route

You are implementing a new route in the Talo backend. Follow all conventions and patterns exactly as described below.

## Four-Tier Routing System

Choose the correct tier based on what's being built:

| Tier          | Prefix       | Auth                   | Config file                      | Routes dir              | Route helper     | Context                 |
| ------------- | ------------ | ---------------------- | -------------------------------- | ----------------------- | ---------------- | ----------------------- |
| **Protected** | `/`          | JWT (`JWT_SECRET`)     | `src/config/protected-routes.ts` | `src/routes/protected/` | `protectedRoute` | `ProtectedRouteContext` |
| **API**       | `/v1/`       | JWT (`game.apiSecret`) | `src/config/api-routes.ts`       | `src/routes/api/`       | `apiRoute`       | `APIRouteContext`       |
| **Admin API** | `/admin/v1/` | Admin API key (bearer) | `src/config/admin-api-routes.ts` | `src/routes/admin/`     | `adminRoute`     | `AdminAPIRouteContext`  |
| **Public**    | `/public/`   | None                   | `src/config/public-routes.ts`    | `src/routes/public/`    | `publicRoute`    | `PublicRouteContext`    |

If you are unsure, ask the user before proceeding.

## Step-by-Step Checklist

Work through these steps in order:

### 1. Identify the tier and feature directory

Determine which tier applies and whether a feature directory already exists (e.g., `src/routes/api/player/`). If adding to an existing feature, read the existing `index.ts` and relevant files first to understand the current structure.

**Admin API routes mirror the protected (or game-facing API) routes and share their logic.** When adding an admin route, first check whether a protected/API route for the same feature exists. If it does:

- Extract (or reuse) a shared handler from the protected route. Name it `[action][Feature]Handler` (e.g. `createStatHandler`, `listLeaderboardsHandler`).
- The shared handler takes `actor: User | AdminAPIKey` so both tiers can pass their authenticated principal (protected passes `ctx.state.user`, admin passes `ctx.state.key`).
- The admin route then only adds the admin-specific wiring: scope gate, game-scoped loader, docs.

### 2. Create the route file

**File placement:**

- One route per file (e.g., `get.ts`, `post.ts`, `update.ts`, `delete.ts`)
- Exception: if the router has only one route, inline it in `index.ts`
- If the feature is new, create the directory first

**Route file structure:**

```typescript
// src/routes/api/my-feature/get.ts
import { RouteDocs } from '../../../lib/docs/docs-registry.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'

// If using docs AND this is a module-level export, define docs FIRST (before the route)
const docs = {
  description: '...',
  samples: [{ title: 'Sample response', sample: { ... } }],
} satisfies RouteDocs

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs,
  schema: (z) => ({ ... }),
  middleware: withMiddleware(...),
  handler: async (ctx) => {
    // Use ctx.em for database queries
    // Use ctx.state.validated for validated input
    return {
      status: 200,
      body: { ... }
    }
  }
})
```

Use the correct route helper and context for the tier (see the table above). Admin route files use `adminRoute` and `AdminAPIRouteContext`.

**Admin route file** (`src/routes/admin/my-feature/create.ts`) — note how it delegates to the shared protected handler:

```typescript
import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { createThingBodySchema } from '../../protected/my-feature/common.js'
import { createThingHandler } from '../../protected/my-feature/create.js'
import { createDocs } from './docs.js'

export const createThingAdminRoute = adminRoute({
  method: 'post',
  docs: createDocs,
  schema: (z) => ({
    body: createThingBodySchema(z),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_THINGS])),
  handler: (ctx) =>
    createThingHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.key, // AdminAPIKey, not User
      data: ctx.state.validated.body,
    }),
})
```

### 3. Add middleware if needed

**Authorization middleware** (import from `src/middleware/policy-middleware.ts`):

```typescript
// API routes:
middleware: withMiddleware(
  requireScopes([APIKeyScope.READ_PLAYERS]), // ALWAYS first
  loadAlias, // then resource loaders
)

// Protected routes:
middleware: withMiddleware(
  ownerGate('view settings'), // or userTypeGate([...]) - ALWAYS first
  requireEmailConfirmed, // then email check
  loadGame, // then resource loaders
)

// Admin API routes:
middleware: withMiddleware(
  requireAdminScopes([AdminAPIKeyScope.READ_STATS]), // ALWAYS first
  loadStat, // then game-scoped resource loaders
)
```

**Ordering rules:**

- API routes: `requireScopes()` → resource loaders
- Protected routes: `ownerGate()` / `userTypeGate()` → `requireEmailConfirmed` → resource loaders
- Admin API routes: `requireAdminScopes()` → resource loaders
- Never wrap middleware definitions with `withMiddleware()` in `common.ts`
- Never use array spread like `[...middleware1, ...middleware2]`
- Use `ownerGate()` (not `userTypeGate([])`) for OWNER-only routes

**Admin scopes:** scopes live in the `AdminAPIKeyScope` enum (`src/entities/admin-api-key.ts`). Add a new scope there if none fits. `FULL_ACCESS` (`*`) bypasses all checks; it is handled inside `requireAdminScopes`.

**Game scoping:** admin API requests carry `ctx.state.game` (the key's game) from `adminAPIKeyMiddleware`. Every resource loaded by id MUST be scoped to it — return 404 for cross-game ids, never 403.

**Custom route middleware** goes in the per-tree `common.ts`:

```typescript
// src/routes/api/my-feature/common.ts
import { APIRouteContext } from '../../../lib/routing/context.js'
import { Next } from 'koa'

export async function loadMyEntity(ctx: APIRouteContext<{ entity: MyEntity }>, next: Next) {
  const { id } = ctx.params as { id: string }

  const entity = await ctx.em.repo(MyEntity).findOne({ id: Number(id), game: ctx.state.game })

  if (!entity) {
    return ctx.throw(404, 'Entity not found')
  }

  ctx.state.entity = entity
  await next()
}
```

Admin loaders take `AdminAPIRouteContext<{ entity: Entity }>` and scope by game:

```typescript
// src/routes/admin/my-feature/common.ts
export async function loadMyEntity(ctx: AdminAPIRouteContext<{ entity: MyEntity }>, next: Next) {
  const { id } = ctx.params as { id: string }

  const entity = await ctx.em.repo(MyEntity).findOne({ id: Number(id), game: ctx.state.game })

  if (!entity) {
    return ctx.throw(404, 'Entity not found')
  }

  ctx.state.entity = entity
  await next()
}
```

Resource loaders are duplicated per route tree (protected/api/admin each have their own `loadX`); only generic middleware lives in `src/middleware/`.

Use `return ctx.throw()` (with `return`) for type narrowing after the throw.

### 4. Add Zod validation schema if needed

```typescript
schema: (z) => ({
  // For route params (key is `route`, NOT `params`):
  route: z.object({
    id: numericStringSchema.meta({ description: 'The entity ID' }),
  }),
  // For query strings:
  query: z.object({
    page: z.coerce.number().optional(),
  }),
  // For request body:
  body: z.object({
    name: z.string({ error: 'name is missing' }).min(1, { message: 'name is invalid' }),
  }),
  // For headers (use looseObject):
  headers: z.looseObject({
    'x-talo-alias': z.string({ error: 'x-talo-alias is missing' }),
  }),
})
```

Access validated data via `ctx.state.validated.body`, `.query`, `.route`, `.headers` - NOT `ctx.request.body`.

Schema params get descriptions via `.meta({ description })`. Reuse shared schemas from `src/lib/validation/routes/[feature]/` and `src/routes/protected/[feature]/common.ts` where they exist (e.g. `createStatBodySchema`). Note: `z.object().partial()` strips meta — re-apply it (see `optionalFields` in `src/routes/protected/game-stat/common.ts`).

Always wrap inline routes with the route helper when using `schema`:

```typescript
route(apiRoute({ schema: ..., handler: ... }))  // ✅
route({ schema: ..., handler: ... })            // ❌ loses type inference
```

### 5. Create or update `index.ts`

```typescript
// src/routes/api/my-feature/index.ts
import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { postRoute } from './post.js'

export function myFeatureAPIRouter(router: Router) {
  apiRouter(
    '/v1/my-feature',
    ({ route }) => {
      route(getRoute)
      route(postRoute)
    },
    { router, docsKey: 'MyFeatureAPI' },
  )
}
```

Admin routers use `adminRouter`, live at `/admin/v1/my-feature`, import the `*AdminRoute` exports, are named `[feature]AdminRouter` (e.g. `gameStatAdminRouter`), and always pass a `docsKey` like `'MyFeatureAdminAPI'`:

```typescript
// src/routes/admin/my-feature/index.ts
import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { createThingAdminRoute } from './create.js'
import { listThingsAdminRoute } from './list.js'

export function myFeatureAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/my-feature',
    ({ route }) => {
      route(createThingAdminRoute)
      route(listThingsAdminRoute)
    },
    { router, docsKey: 'MyFeatureAdminAPI' },
  )
}
```

### 6. Register the router

Add the factory call to the appropriate config file if it's a new router. Both config files already build a `mainRouter` and mount it; only the import and the call are new.

```typescript
// src/config/api-routes.ts
import { myFeatureAPIRouter } from '../routes/api/my-feature/index.js'

// inside configureAPIRoutes, alongside the other router calls
myFeatureAPIRouter(mainRouter)
```

```typescript
// src/config/admin-api-routes.ts
import { myFeatureAdminRouter } from '../routes/admin/my-feature/index.js'

// inside configureAdminAPIRoutes, alongside the other router calls
myFeatureAdminRouter(mainRouter)
```

### 7. Add docs

Every route should carry docs. Each feature dir has a `docs.ts` exporting one `RouteDocs` const per route (`createDocs`, `findDocs`, ...). Import the matching const into the route file.

```typescript
// src/routes/admin/my-feature/docs.ts
import { RouteDocs } from '../../../lib/docs/docs-registry.js'

export const getDocs = {
  description: 'Get a my-feature by ID',
  samples: [
    {
      title: 'Sample response',
      sample: { myFeature: { id: 1 } },
    },
    {
      title: 'Sample request',
      sample: {
        url: '/admin/v1/my-feature?withMetrics=1',
        query: { withMetrics: '1' },
      },
    },
  ],
} satisfies RouteDocs
```

**Key docs rules:**

- `samples` entries are `{ title, sample }` (NOT `request`/`response`).
- For module-level exported routes: define/import `docs` BEFORE the route (avoid "Cannot access before initialization").
- For inline routes (inside router function body): docs can go at the bottom.
- `docsKey` on the router sets the service name for all routes.
- Scopes are automatically extracted from `requireScopes()` / `requireAdminScopes()` - do NOT add them manually.

### 8. Write tests

Create tests in the matching location:

- API route at `src/routes/api/my-feature/` → tests at `tests/routes/api/my-feature/`
- Protected route at `src/routes/protected/my-feature/` → tests at `tests/routes/protected/my-feature/`
- Admin API route at `src/routes/admin/my-feature/` → tests at `tests/routes/admin/my-feature/`

Admin tests use `createAdminAPIKey(scopes)` from `tests/utils/createAdminAPIKey.ts` and authenticate with `.auth(keyString, { type: 'bearer' })`. Cover the allowed case and the missing-scope 403:

```typescript
import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('My feature admin API - create', () => {
  it('should create for a key with the write scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_THINGS])

    await request(app).post('/admin/v1/my-feature').auth(keyString, { type: 'bearer' }).expect(200)
  })

  it('should return 403 for a key missing the write scope', async () => {
    const { keyString } = await createAdminAPIKey([])

    const res = await request(app)
      .post('/admin/v1/my-feature')
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:things')
  })
})
```

Follow the pattern of existing test files in the project. Run `pnpm test path/to/test` to verify.

## Key Conventions Summary

- Router functions named: `[feature]Router`, `[feature]APIRouter` or `[feature]AdminRouter`
- Entity names are singular (Player, not Players)
- Use `ctx.em` for all database access
- Use lazy loading for entity relationships
- Use `return ctx.throw(status, message)` for type narrowing
- MikroORM Identity Map: don't re-query entities already loaded in the request
- TypeScript types are fully inferred - never pass explicit generics to route helpers
- Admin API routes share handlers with protected routes and take `actor: User | AdminAPIKey`
- Admin resources are always scoped to `ctx.state.game` (404, never 403, for cross-game ids)
