# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Talo is a self-hostable game development services platform providing leaderboards, player authentication, peer-to-peer multiplayer, event tracking, and more. The backend is built with Koa (Node.js web framework) and follows a service-based architecture with three routing tiers.

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
   - Services in: `src/services/`

2. **API Routes** (`/v1/` prefix) - Game-facing REST API
   - Auth: JWT signed with `game.apiSecret` (per-game API key)
   - Configured in: `src/config/api-routes.ts`
   - Services in: `src/services/api/`

3. **Public Routes** (`/public/` prefix) - Unauthenticated endpoints
   - Use cases: Webhooks, health checks, password reset
   - Configured in: `src/config/public-routes.ts`
   - Services in: `src/services/public/`

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

Finally, service handlers execute with policy-based authorization.

### Service Layer (Controllers)

Services extend `koa-clay`'s `Service` class and use decorators to define routes:

```typescript
import { Service, Route } from 'koa-clay'
import { HasPermission } from '../policies/decorators'
import { GamePolicy } from '../policies/game.policy'

class GameService extends Service {
  @Route('GET /')
  @HasPermission(GamePolicy, 'list')
  async index(ctx: Koa.Context) {
    const games = await ctx.em.find(Game, { organisation: ctx.state.user.organisation })
    return { games }
  }
}
```

Services receive `ctx.em` (MikroORM EntityManager) for database access and `ctx.state` containing authenticated user/player/game/API key.

### Policy Layer (Authorization)

Policies enforce authorization rules. Use `@HasPermission(PolicyClass, methodName)` decorator on routes:

```typescript
import Policy from './policy'

export default class GamePolicy extends Policy {
  async list(ctx: Koa.Context) {
    await this.checkUserAccessForGame(ctx) // Throws if unauthorized
  }
}
```

Base `Policy` class provides:
- `canAccessGame()` - Verify user/API key can access game
- `hasScope()` / `hasScopes()` - Check API key scopes (READ_PLAYERS, WRITE_PLAYERS, etc.)
- `getUser()` / `getAPIKey()` - Get authenticated identity
- `@UserTypeGate()` decorator - Gate by user role (OWNER, ADMIN, DEV)

API policies check scopes; protected policies check user organization membership.

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
├── services/                # Route handlers (controllers)
│   ├── api/                 # Game-facing API endpoints
│   └── public/              # Unauthenticated endpoints
├── policies/                # Authorization logic
│   └── api/                 # API-specific policies (scope checks)
├── middleware/              # Request pipeline processors
├── config/                  # Route registration, providers, scheduled tasks
├── lib/                     # Shared utilities
│   ├── auth/                # JWT, API key handling
│   ├── props/               # Game live config, property validation
│   ├── billing/             # Stripe integration
│   ├── queues/              # BullMQ job management
│   └── clickhouse/          # Analytics database client
├── socket/                  # WebSocket implementation
├── tasks/                   # Background job definitions
├── migrations/              # Database schema migrations
│   └── clickhouse/          # ClickHouse-specific migrations
├── emails/                  # Email templates (Handlebars)
└── docs/                    # API documentation generators
```

## Common Patterns

### Migrating from koa-clay Services to New Router Pattern

The codebase is transitioning from `koa-clay` Service classes to a new router-based pattern using `koa-tree-router`. This provides better type safety, clearer route organization, and eliminates the need for decorator-based routing.

#### Key Differences

**Old Pattern (koa-clay):**
```typescript
import { Service, Route } from 'koa-clay'
import { HasPermission } from '../policies/decorators'

class UserService extends Service {
  @Route('GET /me')
  @HasPermission(UserPolicy, 'me')
  async me(ctx: Koa.Context) {
    return { user: ctx.state.user }
  }
}
```

**New Pattern (koa-tree-router):**
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

#### Router Factory Functions

Three router factories correspond to the three routing tiers:

1. **`publicRouter(basePath, builder)`** - For public routes (`/public/*`)
2. **`protectedRouter(basePath, builder)`** - For protected routes (`/*`)
3. **`apiRouter(basePath, builder)`** - For API routes (`/v1/*`)

Each factory provides a `route()` helper that accepts route configurations.

#### Route Helper Functions

Three route helpers provide type safety for route configurations:

1. **`publicRoute(config)`** - Returns `RouteConfig<PublicRouteState>`
2. **`protectedRoute(config)`** - Returns `RouteConfig<ProtectedRouteState>`
3. **`apiRoute(config)`** - Returns `RouteConfig<APIRouteState>`

Route configurations support:
- `method`: HTTP method ('get', 'post', 'put', 'patch', 'delete')
- `path`: Route path (relative to router basePath)
- `handler`: Async function receiving typed context
- `middleware`: Optional middleware array (use `withMiddleware()` wrapper)
- `validation`: Optional Zod schema for request body validation
- `docs`: Optional documentation metadata (description, params, samples, scopes, serviceName)

#### File Organization

**One route per file** unless the router only has one route, in which case it can be inlined in `index.ts`:

```
src/routes/
├── public/
│   ├── demo/
│   │   └── index.ts              # Simple routes inline in index
│   ├── webhooks/
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
    └── [future API routes]
```

#### Middleware Patterns

**Creating Middleware (common.ts):**

Middleware functions should be plain async functions that receive context and call `next()`:

```typescript
import bcrypt from 'bcrypt'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { Next } from 'koa'

export const confirmPassword = async (ctx: ProtectedRouteContext, next: Next) => {
  const { password } = ctx.request.body as { password: string }
  const user = ctx.state.authenticatedUser

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) {
    ctx.throw(403, 'Incorrect password')
  }

  await next()
}

export const requires2fa = async (ctx: ProtectedRouteContext, next: Next) => {
  const user = ctx.state.authenticatedUser

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
    const user = ctx.state.authenticatedUser
    // ... handler logic
  }
})
```

**Built-in Authorization Middleware:**

The codebase provides reusable authorization middleware in `src/middleware/policy-middleware.ts`:

```typescript
import { userTypeGate, ownerGate } from '../../../middleware/policy-middleware'

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

#### Context Types

Use typed context for better type safety:

- **`PublicRouteContext`** - `AppParameterizedContext<PublicRouteState>`
- **`ProtectedRouteContext`** - `AppParameterizedContext<ProtectedRouteState>`
- **`APIRouteContext`** - `AppParameterizedContext<APIRouteState>`

Access context properties:
- `ctx.em` - MikroORM EntityManager
- `ctx.state.user` - Authenticated user (protected routes)
- `ctx.state.apiKey` - API key (API routes)
- `ctx.state.currentPlayer` - Current player (API routes)
- `ctx.request.body` - Parsed request body
- `ctx.throw(status, message)` - Throw HTTP errors

#### Validation with Zod

Replace `@Validate` decorators with inline Zod schemas using the `schema` field:

**Old Pattern:**
```typescript
class UserService extends Service {
  @Route('POST /register')
  @Validate({ body: { email: { type: 'string', format: 'email' } } })
  async register(ctx: Koa.Context) { ... }
}
```

**New Pattern:**
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

**IMPORTANT:**
- Use `schema` field (not `validation`) which receives `z` (Zod) as a parameter
- Access validated data from `ctx.state.validated.body`, not `ctx.request.body`
- The schema function can validate `body`, `query`, `params`, etc.
- All validated fields are available under `ctx.state.validated`

#### Documentation

Add documentation inline with route configuration:

```typescript
export const createRoute = protectedRoute({
  method: 'post',
  path: '/',
  docs: {
    serviceName: 'MyService',
    description: 'Creates a new resource',
    params: {
      body: {
        name: { type: 'string', description: 'Resource name' }
      }
    },
    samples: [{
      title: 'Create resource',
      method: 'POST',
      uri: '/resources',
      body: { name: 'Example' }
    }]
  },
  handler: async (ctx) => { ... }
})
```

The `serviceName` field is used for documentation generation. For routes without docs, it can be omitted.

#### Background Jobs Integration

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

// Use in routes/services:
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

// src/lib/queues/createDemoUserQueue.ts
import createQueue from './createQueue'
import { getMikroORM } from '../../config/mikro-orm.config'

export function createDemoUserQueue() {
  return createQueue<{ userId: number }>('demo', async (job) => {
    const { userId } = job.data
    const orm = await getMikroORM()
    const em = orm.em.fork()
    // ... cleanup logic
  })
}
```

This pattern keeps route-specific logic localized while still organizing queue creation in the lib/queues directory.

#### Registering Routers

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
  // ... existing services
  app.use(userRouter().routes())
}
```

**API routes (`src/config/api-routes.ts`):**
```typescript
import { playerRouter } from '../routes/api/player'

export default function apiRoutes(app: Koa) {
  // ... existing services
  app.use(playerRouter().routes())
}
```

#### Migration Checklist

When converting a koa-clay Service to new router pattern:

1. ✅ Create route directory: `src/routes/{public|protected|api}/[feature]/`
2. ✅ Create one file per route (or inline simple routes in index.ts)
3. ✅ Extract shared middleware to `common.ts` as plain async functions
4. ✅ Use `withMiddleware()` wrapper in route configs, not in middleware definitions
5. ✅ Replace `@Validate` decorators with Zod `validation` config
6. ✅ Replace `@HasPermission` with inline authorization checks or middleware
7. ✅ Move documentation from decorators to `docs` config field
8. ✅ Create index.ts that exports router function
9. ✅ Register router in appropriate config file
10. ✅ Remove old Service class and imports
11. ✅ Update tests to match new route paths

#### Type Safety Limitations

TypeScript cannot partially infer type parameters. This means:

**Does NOT work:**
```typescript
type CustomState = ProtectedRouteState & { customProp: string }
export const route = protectedRoute<CustomState>({ ... })  // ❌ Won't infer validation type
```

**Workarounds:**
- Let TypeScript fully infer types (recommended for most cases)
- Specify both type parameters if needed (rare)
- Use type assertions only when necessary
- Extend state in middleware and access directly in handlers

### Adding a New API Endpoint

1. Create service in `src/services/api/my-feature-api.service.ts`
2. Create policy in `src/policies/api/my-feature-api.policy.ts` with scope checks
3. Register in `src/config/api-routes.ts`:
   ```typescript
   app.use(service('/v1/my-feature', new MyFeatureAPIService()))
   ```
4. Add tests in `tests/services/_api/my-feature-api/`

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

### Authentication vs Authorization

- **Authentication**: Handled by middleware (JWT validation, API key extraction)
- **Authorization**: Handled by policies (user roles, API scopes, game access)

### Working with Props

Props are flexible key-value pairs on entities (Player, Game, LeaderboardEntry):
- Validated size limits (prevent abuse)
- Stored as JSON in database
- Access via entity's `props` array

## Testing

Tests use Vitest with Docker containers for MySQL/Redis/ClickHouse.

Test file structure mirrors `src/` directory:
- `tests/services/_api/` - API endpoint tests
- `tests/services/` - Protected route tests
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
- Services are named `[Entity]Service` or `[Entity]APIService`
- Policies are named `[Entity]Policy` or `[Entity]APIPolicy`
- Test files end with `.test.ts`
- Migration files: `[Timestamp][PascalCaseDescription].ts`
- Use lazy loading for entity relationships to avoid circular dependencies
- Always check authorization in policies before handler execution
- API endpoints require scope checks; protected endpoints require user access checks
