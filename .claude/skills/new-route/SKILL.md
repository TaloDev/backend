---
name: new-route
description: Create a new route in the Talo backend following project conventions
argument-hint: "<route description, e.g. 'GET /v1/players/:id for fetching a player'>"
disable-model-invocation: true
---

<new-route>

# Create a New Route

You are implementing a new route in the Talo backend. Follow all conventions and patterns exactly as described below.

## User Request

$ARGUMENTS

## Three-Tier Routing System

Choose the correct tier based on what's being built:

| Tier | Prefix | Auth | Config file | Routes dir |
|------|--------|------|-------------|------------|
| **Protected** | `/` | JWT (`JWT_SECRET`) | `src/config/protected-routes.ts` | `src/routes/protected/` |
| **API** | `/v1/` | JWT (`game.apiSecret`) | `src/config/api-routes.ts` | `src/routes/api/` |
| **Public** | `/public/` | None | `src/config/public-routes.ts` | `src/routes/public/` |

## Step-by-Step Checklist

Work through these steps in order:

### 1. Identify the tier and feature directory

Determine which tier applies and whether a feature directory already exists (e.g., `src/routes/api/player/`). If adding to an existing feature, read the existing `index.ts` and relevant files first to understand the current structure.

### 2. Create the route file

**File placement:**
- One route per file (e.g., `get.ts`, `post.ts`, `update.ts`, `delete.ts`)
- Exception: if the router has only one route, inline it in `index.ts`
- If the feature is new, create the directory first

**Route file structure:**

```typescript
// src/routes/api/my-feature/get.ts
import { apiRoute } from '../../../lib/routing/router'

// If using docs AND this is a module-level export, define docs FIRST (before the route)
const docs = {
  description: '...',
  samples: []
} satisfies RouteDocs

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs,
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

Use the correct route helper and context for the tier:
- API: `apiRoute` / `APIRouteContext`
- Protected: `protectedRoute` / `ProtectedRouteContext`
- Public: `publicRoute` / `PublicRouteContext`

### 3. Add middleware if needed

**Authorization middleware** (import from `src/middleware/policy-middleware.ts`):

```typescript
middleware: withMiddleware(
  requireScopes([APIKeyScope.READ_PLAYERS]),  // API routes: ALWAYS first
  loadAlias,                                  // then resource loaders
)

// Protected routes:
middleware: withMiddleware(
  ownerGate('view settings'),   // or userTypeGate([...]) - ALWAYS first
  requireEmailConfirmed,        // then email check
  loadGame,                     // then resource loaders
)
```

**Ordering rules:**
- API routes: `requireScopes()` → resource loaders
- Protected routes: `ownerGate()` / `userTypeGate()` → `requireEmailConfirmed` → resource loaders
- Never wrap middleware definitions with `withMiddleware()` in `common.ts`
- Never use array spread like `[...middleware1, ...middleware2]`
- Use `ownerGate()` (not `userTypeGate([])`) for OWNER-only routes

**Custom route middleware** goes in `common.ts`:

```typescript
// src/routes/api/my-feature/common.ts
import { APIRouteContext } from '../../../lib/routing/context'
import { Next } from 'koa'

export async function loadMyEntity(ctx: APIRouteContext<{ entity: MyEntity }>, next: Next) {
  const entity = await ctx.em.repo(MyEntity).findOne({ id: ctx.params.id })
  if (!entity) return ctx.throw(404, 'Entity not found')
  ctx.state.entity = entity
  await next()
}
```

Use `return ctx.throw()` (with `return`) for type narrowing after the throw.

### 4. Add Zod validation schema if needed

```typescript
schema: (z) => ({
  // For route params:
  params: z.object({
    id: z.coerce.number().meta({ description: 'The entity ID' })
  }),
  // For query strings:
  query: z.object({
    page: z.coerce.number().optional()
  }),
  // For request body:
  body: z.object({
    name: z.string({ error: 'name is missing' }).min(1, { message: 'name is invalid' })
  }),
  // For headers (use looseObject):
  headers: z.looseObject({
    'x-talo-alias': z.string({ error: 'x-talo-alias is missing' })
  })
})
```

Access validated data via `ctx.state.validated.body`, `.query`, `.params`, `.headers` - NOT `ctx.request.body`.

Always wrap inline routes with the route helper when using `schema`:
```typescript
route(apiRoute({ schema: ..., handler: ... }))  // ✅
route({ schema: ..., handler: ... })             // ❌ loses type inference
```

### 5. Create or update `index.ts`

```typescript
// src/routes/api/my-feature/index.ts
import { apiRouter } from '../../../lib/routing/router'
import { getRoute } from './get'
import { postRoute } from './post'

export function myFeatureAPIRouter() {
  return apiRouter('/v1/my-feature', ({ route }) => {
    route(getRoute)
    route(postRoute)
  }, {
    docsKey: 'MyFeatureAPI'  // set if this router has docs
  })
}
```

### 6. Register the router

Add to the appropriate config file if it's a new router:

```typescript
// src/config/api-routes.ts
import { myFeatureAPIRouter } from '../routes/api/my-feature'

export default function apiRoutes(app: Koa) {
  // ...existing routers...
  app.use(myFeatureAPIRouter().routes())
}
```

### 7. Add docs (for API routes)

If docs exist for other routes in this folder, add to `docs.ts`. If this is the first route with docs, create `docs.ts`:

```typescript
// src/routes/api/my-feature/docs.ts
import { RouteDocs } from '../../../lib/docs/docs-registry'

export const getDocs = {
  description: 'Get a my-feature by ID',
  samples: [
    {
      title: 'Get my-feature',
      request: {},
      response: { status: 200, body: { myFeature: { id: 1 } } }
    }
  ]
} satisfies RouteDocs
```

**Key docs rules:**
- For module-level exported routes: define `docs` const BEFORE the route (avoid "Cannot access before initialization")
- For inline routes (inside router function body): docs can go at the bottom
- `docsKey` on the router sets the service name for all routes
- Scopes are automatically extracted from `requireScopes()` - do NOT add them manually

### 8. Write tests

Create tests in the matching location:
- API route at `src/routes/api/my-feature/` → tests at `tests/routes/api/my-feature-api/`
- Protected route at `src/routes/protected/my-feature/` → tests at `tests/routes/protected/my-feature/`

Follow the pattern of existing test files in the project. Run `npm test path/to/test` to verify.

## Key Conventions Summary

- Router functions named: `[feature]Router` or `[feature]APIRouter`
- Entity names are singular (Player, not Players)
- Use `ctx.em` for all database access
- Use lazy loading for entity relationships
- Use `return ctx.throw(status, message)` for type narrowing
- MikroORM Identity Map: don't re-query entities already loaded in the request
- TypeScript types are fully inferred - never pass explicit generics to route helpers

</new-route>
