# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Talo is a self-hostable game development services platform providing leaderboards, player authentication, peer-to-peer multiplayer, event tracking, and more. The backend is built with Koa (Node.js web framework) using `koa-tree-router` for routing.

## Development Commands

### Setup
```bash
npm install
# Copy envs/.env.dev to .env, then:
npm run up              # Start Docker containers (MySQL, Redis, ClickHouse)
npm run seed            # Seed database with test data (creates admin@trytalo.com and dev@trytalo.com, password: password)
```

### Development
```bash
npm run watch           # Run with hot reload
npm run logs            # View backend logs
npm run restart         # Restart backend container and show logs
npm run down            # Stop Docker containers
```

### Testing
```bash
npm test                # Run all tests with Vitest
npm test path/to/file   # Run specific test file
npm test -- --coverage  # Run with coverage report
```

Tests run against Docker containers and automatically backup/restore database state. Environment variables from `.env` are combined with `envs/.env.test`.

### Building & Linting
```bash
npm run build           # Compile TypeScript
npm run lint            # Run ESLint
```

### Database Migrations
```bash
npm run migration:create    # Create new MikroORM migration
npm run migration:up        # Run pending migrations
```

After creating a migration:
1. Rename from `Migration[Timestamp].ts` to `[Timestamp][PascalCaseDescription].ts`
2. Rename the exported class to match the description
3. Import and add to `migrations/index.ts`

ClickHouse migrations are created manually in `src/migrations/clickhouse/` and registered in `src/migrations/clickhouse/index.ts`.

## Architecture

### Three-Tier Routing System

The application uses three distinct routing layers with different authentication:

1. **Protected Routes** (`/` prefix) - Web dashboard endpoints
   - Auth: JWT signed with `JWT_SECRET` (user identity)
   - Configured in: `src/config/protected-routes.ts`
   - Routes in: `src/routes/protected/`

2. **API Routes** (`/v1/` prefix) - Game-facing REST API
   - Auth: JWT signed with `game.apiSecret` (per-game API key)
   - Configured in: `src/config/api-routes.ts`
   - Routes in: `src/routes/api/`

3. **Public Routes** (`/public/` prefix) - Unauthenticated endpoints
   - Use cases: Webhooks, health checks, password reset
   - Configured in: `src/config/public-routes.ts`
   - Routes in: `src/routes/public/`

### Request Flow

Middleware executes in order (see `src/index.ts`):
1. **Compression** - Response compression
2. **Logger** - Request logging (production only)
3. **Error Middleware** - Global error handling with Sentry integration
4. **Body Parser** - Parse JSON request bodies
5. **HTTP Tracing** - OpenTelemetry/HyperDX distributed tracing
6. **Helmet** - Security headers
7. **CORS** - Cross-origin resource sharing
8. **Dev Data** - Development utilities
9. **Request Context** - Sets up request-scoped context

Then route-specific middleware:
- **API Routes**: API key extraction → JWT auth → rate limiting → current player resolution → player auth validation → continuity checks
- **Protected Routes**: JWT auth → user authorization
- **Public Routes**: No authentication

Finally, route handlers execute.

### Entity Layer (Models)

MikroORM entities with TypeScript decorators:

```typescript
import { Entity, Property, ManyToOne } from '@mikro-orm/core'

@Entity()
export default class Player {
  @PrimaryKey()
  id: number

  @Property()
  createdAt: Date = new Date()

  @ManyToOne(() => Game, { lazy: true })
  game: Game

  @Property()
  props: PlayerProp[] = []
}
```

Key patterns:
- **Props**: Flexible key-value pairs embedded in entities for custom data
- **Lazy loading**: Relationships loaded on access
- **Lifecycle hooks**: Automatic createdAt/updatedAt timestamps

### Database Architecture

- **MySQL** (MikroORM): Core relational data (users, games, players, leaderboards)
- **Redis**: Caching, job queue storage (BullMQ), session data
- **ClickHouse**: Analytics time-series data (events, metrics)

All handlers receive `ctx.em` (EntityManager) for queries. Migrations run automatically on startup (except in test mode).

### MikroORM Identity Map & Request Context

Each HTTP request has its own isolated EntityManager with an **Identity Map** - an in-memory cache that maintains a single instance of each entity throughout the request lifecycle.

**Key behaviors:**
- When you query the same entity multiple times within a request, you get the identical object reference
- Entities already loaded in the Identity Map are automatically populated into newly fetched entities
- If entity A is loaded with its relations, and later entity B references A, the already-loaded A (with its relations) is used

**Practical implication:** You don't need to explicitly load relations if they're already in memory from a previous query in the same request. For example:

```typescript
// In API middleware, ctx.state.game is loaded
// Later in loadAlias middleware:
const alias = await ctx.em.repo(PlayerAlias).findOne({
  id: aliasId,
  player: { game: ctx.state.game }  // game already in Identity Map
})
// alias.player.game is automatically populated from the Identity Map
// No need to explicitly load it via `fields: ['player.game.id']`
```

The request context is set up via middleware using Node's `AsyncLocalStorage`, ensuring parallel requests don't interfere with each other.

### Background Jobs & Scheduling

BullMQ for async jobs, configured in `src/config/global-queues.ts`. Scheduled tasks defined in `src/config/scheduled-tasks.ts`:
- Archive leaderboard entries
- Delete inactive players
- Cleanup jobs

### WebSocket Layer

Real-time communication via custom WebSocket implementation in `src/socket/`:
- Connection state tracking (game, API key, scopes)
- Message routing and pub/sub patterns
- Socket tickets for authentication

### Key Directories

```
src/
├── index.ts                 # App entry point, middleware pipeline
├── entities/                # MikroORM data models
├── routes/                  # Route handlers
│   ├── api/                 # Game-facing API endpoints (/v1/*)
│   ├── protected/           # Dashboard endpoints (/*)
│   └── public/              # Unauthenticated endpoints (/public/*)
├── middleware/              # Request pipeline processors
├── config/                  # Route registration, providers, scheduled tasks
├── lib/                     # Shared utilities
│   ├── routing/             # Router factories and types
│   ├── docs/                # API documentation registry
│   ├── auth/                # JWT, API key handling
│   ├── props/               # Game live config, property validation
│   ├── billing/             # Stripe integration
│   ├── queues/              # BullMQ job management
│   └── clickhouse/          # Analytics database client
├── socket/                  # WebSocket implementation
├── tasks/                   # Background job definitions
├── migrations/              # Database schema migrations
│   └── clickhouse/          # ClickHouse-specific migrations
└── emails/                  # Email templates (Handlebars)
```

## Routing

### Router Factory Functions

Three router factories correspond to the three routing tiers:

1. **`publicRouter(basePath, builder)`** - For public routes (`/public/*`)
2. **`protectedRouter(basePath, builder)`** - For protected routes (`/*`)
3. **`apiRouter(basePath, builder)`** - For API routes (`/v1/*`)

Each factory provides a `route()` helper that accepts route configurations.

### Route Helper Functions

Three route helpers provide type safety for route configurations:

1. **`publicRoute(config)`** - Returns `RouteConfig<PublicRouteState>`
2. **`protectedRoute(config)`** - Returns `RouteConfig<ProtectedRouteState>`
3. **`apiRoute(config)`** - Returns `RouteConfig<APIRouteState>`

Route configurations support:
- `method`: HTTP method ('get', 'post', 'put', 'patch', 'delete')
- `path`: Route path (relative to router basePath, can be omitted for root routes)
- `handler`: Async function receiving typed context
- `middleware`: Optional middleware array (use `withMiddleware()` wrapper)
- `schema`: Optional Zod schema for request validation
- `docs`: Optional documentation metadata (description, samples)

### Basic Route Example

```typescript
// src/routes/protected/user/me.ts
import { protectedRoute } from '../../../lib/routing/router'

export const meRoute = protectedRoute({
  method: 'get',
  path: '/me',
  handler: async (ctx) => {
    return {
      status: 200,
      body: { user: ctx.state.user }
    }
  }
})

// src/routes/protected/user/index.ts
import { protectedRouter } from '../../../lib/routing/router'
import { meRoute } from './me'

export function userRouter() {
  return protectedRouter('/users', ({ route }) => {
    route(meRoute)
  })
}
```

### Type Inference with Validation Schemas

When using `schema` for validation inside a router builder, wrap the config with the appropriate route helper (`apiRoute`, `protectedRoute`, `publicRoute`) to ensure proper type inference for `ctx.state.validated`:

```typescript
// ✅ Correct - wrap with apiRoute() for proper type inference
route(apiRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({ page: z.coerce.number() })
  }),
  handler: async (ctx) => {
    const { page } = ctx.state.validated.query  // ✅ TypeScript knows the type
  }
}))

// ❌ Wrong - inline config loses type inference for validated state
route({
  method: 'get',
  schema: (z) => ({
    query: z.object({ page: z.coerce.number() })
  }),
  handler: async (ctx) => {
    const { page } = ctx.state.validated.query  // ❌ Type error
  }
})
```

### File Organization

**One route per file** unless the router only has one route, in which case it can be inlined in `index.ts`:

```
src/routes/
├── public/
│   ├── demo/
│   │   └── index.ts              # Simple routes inline in index
│   ├── webhook/
│   │   └── subscriptions.ts      # Complex routes in separate files
│   └── documentation/
│       └── index.ts
├── protected/
│   └── user/
│       ├── index.ts               # Router registration
│       ├── common.ts              # Shared middleware
│       ├── me.ts                  # One route per file
│       ├── logout.ts
│       ├── change-password.ts
│       ├── 2fa-enable.ts
│       └── 2fa-disable.ts
└── api/
    └── player/
        ├── index.ts
        ├── common.ts
        ├── docs.ts                # Documentation for all routes
        ├── identify.ts
        ├── search.ts
        └── ...
```

### Middleware Patterns

**Creating Middleware (common.ts):**

Middleware functions should be plain async functions that receive context and call `next()`:

```typescript
import bcrypt from 'bcrypt'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { Next } from 'koa'

export async function confirmPassword(ctx: ProtectedRouteContext, next: Next) {
  const { password } = ctx.request.body as { password: string }
  const user = ctx.state.user

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) {
    ctx.throw(403, 'Incorrect password')
  }

  await next()
}

export async function requires2fa(ctx: ProtectedRouteContext, next: Next) {
  const user = ctx.state.user

  if (!user.twoFactorAuth?.enabled) {
    ctx.throw(403, 'Two factor authentication needs to be enabled')
  }

  await next()
}
```

**Using Middleware in Routes:**

Wrap middleware functions with `withMiddleware()` in the route configuration:

```typescript
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { confirmPassword, requires2fa } from './common'

export const disable2faRoute = protectedRoute({
  method: 'post',
  path: '/2fa/disable',
  middleware: withMiddleware(confirmPassword, requires2fa),
  handler: async (ctx) => {
    const user = ctx.state.user
    // ... handler logic
  }
})
```

**Built-in Authorization Middleware:**

The codebase provides reusable authorization middleware in `src/middleware/policy-middleware.ts`:

```typescript
import { userTypeGate, ownerGate, requireScopes } from '../../../middleware/policy-middleware'

// Allow specific user types (OWNER always allowed)
userTypeGate([UserType.ADMIN, UserType.DEV], 'create games')

// Require OWNER user type only
ownerGate('view game settings')

// For API routes - require specific scopes
requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
```

**IMPORTANT:**
- Do NOT wrap middleware definitions with `withMiddleware()` in common.ts
- Do NOT use array spread syntax like `[...middleware1, ...middleware2]`
- DO use `withMiddleware(middleware1, middleware2)` in route configs
- Middleware functions are plain async functions; `withMiddleware()` converts them to the format expected by the router
- Use `ownerGate()` instead of `userTypeGate([])` for OWNER-only routes - it's more readable
- Middleware ordering: user type gates (`userTypeGate()`, `ownerGate()`) come first, then `requireEmailConfirmed`, then other middleware (e.g., `loadGame`)
- For API routes, `requireScopes()` should always be checked first in the middleware list, before any resource-loading middleware

**Reusable Middleware:**

Common middleware that loads entities (like `loadGame`, `loadAlias`) should be defined in `src/middleware/` and export a route state type. When using these in route-specific middleware, define a context type that extends the base context with the combined state:

```typescript
// src/middleware/player-alias-middleware.ts
export type PlayerAliasRouteState = {
  alias: PlayerAlias
  currentAliasId?: number
}

export async function loadAlias(ctx: APIRouteContext<PlayerAliasRouteState>, next: Next) {
  // ... load alias into ctx.state.alias
}

// src/routes/api/game-feedback/common.ts
import { PlayerAliasRouteState } from '../../../middleware/player-alias-middleware'

type GameFeedbackCategoryRouteContext = APIRouteContext<
  PlayerAliasRouteState & { category: GameFeedbackCategory, continuityDate?: Date }
>

export async function loadCategory(ctx: GameFeedbackCategoryRouteContext, next: Next) {
  // ctx.state has access to both alias (from PlayerAliasRouteState) and category
}
```

This pattern ensures type safety when composing multiple middleware that each add properties to `ctx.state`.

### Context Types

Use typed context for better type safety:

- **`PublicRouteContext`** - `AppParameterizedContext<PublicRouteState>`
- **`ProtectedRouteContext`** - `AppParameterizedContext<ProtectedRouteState>`
- **`APIRouteContext`** - `AppParameterizedContext<APIRouteState>`

Access context properties:
- `ctx.em` - MikroORM EntityManager
- `ctx.state.user` - Authenticated user (protected routes)
- `ctx.state.key` - API key (API routes)
- `ctx.state.currentPlayer` - Current player (API routes)
- `ctx.state.validated` - Validated request data (when using schema)
- `ctx.request.body` - Parsed request body (use ctx.state.validated.body instead when using schema)
- `ctx.throw(status, message)` - Throw HTTP errors

### Validation with Zod

Use inline Zod schemas with the `schema` field:

```typescript
export const registerRoute = publicRoute({
  method: 'post',
  path: '/register',
  schema: (z) => ({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(8)
    })
  }),
  handler: async (ctx) => {
    // Validated data is available at ctx.state.validated
    const { email, password } = ctx.state.validated.body
    // ... handler logic
  }
})
```

**Key points:**
- Use `schema` field which receives `z` (Zod) as a parameter
- Access validated data from `ctx.state.validated.body`, not `ctx.request.body`
- The schema function can validate `body`, `query`, `params`, `headers`, etc.
- All validated fields are available under `ctx.state.validated`
- Use `z.looseObject()` for headers since Koa includes many default headers
- For custom error messages, use `z.string({ error: 'field is missing' })` for missing fields and `.min(1, { message: 'Invalid field' })` for validation errors

**Header Validation Example:**

```typescript
schema: (z) => ({
  headers: z.looseObject({
    'x-talo-alias': z.string({ error: 'x-talo-alias is missing from the request headers' })
      .regex(/^\d+$/, { error: 'x-talo-alias header must be a numeric string' })
  }),
  body: z.object({
    comment: z.string()
  })
})
```

### Documentation

For API routes, use the `docsKey` option in the router to set a shared service name for all routes. Import `RouteDocs` from `src/lib/docs/docs-registry` for the type.

**Inline routes (inside router function)** - docs can be at the bottom:

```typescript
// src/routes/api/socket-ticket/index.ts
import { apiRouter } from '../../../lib/routing/router'
import { RouteDocs } from '../../../lib/docs/docs-registry'

export function socketTicketAPIRouter() {
  return apiRouter('/v1/socket-tickets', ({ route }) => {
    route({
      method: 'post',
      docs,
      handler: async (ctx) => {
        // ... handler logic
        return {
          status: 200,
          body: { ticket }
        }
      }
    })
  }, {
    docsKey: 'SocketTicketsAPI'
  })
}

const docs = {
  description: 'Create a socket ticket (expires after 5 minutes)',
  samples: [...]
} satisfies RouteDocs
```

**Exported routes (module level)** - docs must be defined BEFORE the route:

```typescript
// src/routes/api/player-group/get.ts
import { apiRoute } from '../../../lib/routing/router'
import { RouteDocs } from '../../../lib/docs/docs-registry'

// docs MUST be defined before the route for module-level exports
const docs = {
  description: 'Get a group',
  samples: [...]
} satisfies RouteDocs

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs,
  handler: async (ctx) => { ... }
})
```

**Key points:**
- `docsKey` in the router options sets the service name for all routes in that router
- Individual routes can override with `docs.key` if needed
- For inline routes (inside function body), docs can be at the bottom of the file
- For exported routes (module level), docs MUST be defined before the route to avoid "Cannot access before initialization" errors
- Import `RouteDocs` from `../../../lib/docs/docs-registry` for the type
- When routes are split into separate files, create a `docs.ts` file in the route folder to keep all documentation together
- **Scopes are automatically extracted** from `requireScopes()` middleware - do NOT add them manually to docs

**Documenting Schema Parameters:**

Use `.meta({ description: '...' })` on schema fields to document parameters:

```typescript
schema: (z) => ({
  route: z.object({
    id: z.uuid().meta({ description: 'The ID of the group' })
  }),
  query: z.object({
    membersPage: pageSchema.meta({ description: 'The current pagination index for group members (starting at 0)' })
  })
})
```

For header schemas that are reused across routes, add `.meta()` in the schema definition file:

```typescript
// src/lib/validation/playerHeaderSchema.ts
export const playerHeaderSchema = z.uuid({
  error: 'x-talo-player header must be a valid player ID'
}).meta({
  description: 'The ID of the player'
})
```

### Background Jobs Integration

**Global Queues (for shared queues used across the application):**

For queues that are used by multiple parts of the application (like email, cache clearing), register them in `src/config/global-queues.ts`:

```typescript
// src/lib/queues/createEmailQueue.ts
import createQueue from './createQueue'

export function createEmailQueue() {
  const queue = createQueue<EmailConfig>('email', async (job) => {
    // ... process email
  })
  return queue
}

// src/config/global-queues.ts
const queueFactories = {
  'email': createEmailQueue,
  'clear-response-cache': createClearResponseCacheQueue,
  // ... other shared queues
} as const

// Use in routes:
import { getGlobalQueue } from '../../../config/global-queues'
await getGlobalQueue('email').add('send', emailData)
```

**Route-Specific Singleton Queues:**

For queues that are only used by a single route or feature, create a singleton queue directly in the route file:

```typescript
// src/routes/public/demo/index.ts
import { createDemoUserQueue } from '../../../lib/queues/createDemoUserQueue'
import type { Queue } from 'bullmq'

let demoQueue: Queue<{ userId: number }> | null = null

function getDemoQueue() {
  if (!demoQueue) {
    demoQueue = createDemoUserQueue()
  }
  return demoQueue
}

export function demoRouter() {
  return publicRouter('/public', ({ route }) => {
    route({
      handler: async (ctx) => {
        await getDemoQueue().add('demo-user', { userId: user.id })
      }
    })
  })
}
```

### Registering Routers

Add router to appropriate config file:

**Public routes (`src/config/public-routes.ts`):**
```typescript
import { demoRouter } from '../routes/public/demo'

export default function publicRoutes(app: Koa) {
  app.use(demoRouter().routes())
}
```

**Protected routes (`src/config/protected-routes.ts`):**
```typescript
import { userRouter } from '../routes/protected/user'

export default function protectedRoutes(app: Koa) {
  app.use(protectedRouteAuthMiddleware)
  app.use(userRouter().routes())
}
```

**API routes (`src/config/api-routes.ts`):**
```typescript
import { playerAPIRouter } from '../routes/api/player'

export default function apiRoutes(app: Koa) {
  app.use(playerAPIRouter().routes())
}
```

### Type Inference

You do not need to provide generics to `apiRoute`, `protectedRoute`, `publicRoute`, or similar helpers - types are inferred automatically from the schema and middleware.

```typescript
// ✅ Correct - let TypeScript infer types
export const postRoute = apiRoute({
  method: 'post',
  schema: (z) => ({ ... }),
  middleware: withMiddleware(requireScopes([...]), loadAlias),
  handler: async (ctx) => { ... }
})

// ❌ Wrong - don't provide explicit generics
export const postRoute = apiRoute<SomeCustomState>({ ... })
```

TypeScript cannot partially infer type parameters, so providing a custom state generic will break validation type inference. Instead, let middleware extend the state and access properties directly in handlers.

## Common Patterns

### Adding a New API Endpoint

1. Create route directory: `src/routes/api/my-feature/`
2. Create route file(s) with handler logic
3. Create `index.ts` that exports the router function
4. Register in `src/config/api-routes.ts`
5. Add tests in `tests/services/_api/my-feature-api/`

### Adding a New Entity

1. Create entity in `src/entities/my-entity.ts` with decorators
2. Run `npm run migration:create` to generate migration
3. Rename and register migration in `src/migrations/index.ts`
4. MikroORM will auto-migrate on next startup

### Error Handling

All errors caught by `src/middleware/error-middleware.ts`:
- Automatic HTTP status code mapping
- Sentry integration for production
- OpenTelemetry tracing context

Throw errors with status codes: `ctx.throw(400, 'Invalid request')`

Use `return ctx.throw()` pattern when you need TypeScript to narrow types after the throw:

```typescript
const player = await em.repo(Player).findOne({ id })
if (!player) {
  return ctx.throw(404, 'Player not found')  // return ensures type narrowing
}
// TypeScript knows player is not null here
```

### Authentication vs Authorization

- **Authentication**: Handled by middleware (JWT validation, API key extraction)
- **Authorization**: Handled by middleware (user type gates, API scopes)

### Working with Props

Props are flexible key-value pairs on entities (Player, Game, LeaderboardEntry):
- Validated size limits (prevent abuse)
- Stored as JSON in database
- Access via entity's `props` array

## Testing

Tests use Vitest with Docker containers for MySQL/Redis/ClickHouse.

Test file structure mirrors `src/` directory:
- `tests/services/_api/` - API endpoint tests
- `tests/services/_protected/` - Protected route tests
- `tests/services/_public/` - Public route tests
- `tests/lib/` - Utility tests
- `tests/entities/` - Entity behavior tests

Helpers available in `tests/` directory for creating test data.

## Docker Environment

Services defined in `docker-compose.yml`:
- **backend**: Node.js app (port 3000)
- **db**: MySQL 8.4 (port 3306)
- **redis**: Redis 8 (port 6379)
- **clickhouse**: ClickHouse 24.12 (port 8123)

All use environment variables from `.env` file.

## Important Conventions

- Entity names are singular (Player, not Players)
- Router functions are named `[feature]Router` or `[feature]APIRouter`
- Test files end with `.test.ts`
- Migration files: `[Timestamp][PascalCaseDescription].ts`
- Use lazy loading for entity relationships to avoid circular dependencies
- API endpoints require scope checks via `requireScopes()` middleware
- Protected endpoints require user type checks via `userTypeGate()` or `ownerGate()` middleware
