# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Talo is a self-hostable game development services platform providing leaderboards, player authentication, peer-to-peer multiplayer, event tracking, and more. The backend is built with Koa (Node.js web framework) running on Bun and follows a service-based architecture with three routing tiers.

## Runtime

This project uses **Bun** (not Node.js) as the JavaScript runtime. Bun is a fast all-in-one toolkit that includes:
- JavaScript/TypeScript runtime (drop-in Node.js replacement)
- Package manager (replaces npm)
- Test runner (uses Vitest)
- Bundler and transpiler

All commands use `bun` instead of `npm`. The `NODE_ENV` environment variable is still used for backwards compatibility with ecosystem libraries.

## Development Commands

### Setup
```bash
bun install
# Copy envs/.env.dev to .env, then:
bun run up              # Start Docker containers (MySQL, Redis, ClickHouse)
bun run seed            # Seed database with test data (creates admin@trytalo.com and dev@trytalo.com, password: password)
```

### Development
```bash
bun run watch           # Run with hot reload (uses bun --hot)
bun run logs            # View backend logs
bun run restart         # Restart backend container and show logs
bun run down            # Stop Docker containers
```

### Testing
```bash
bun test                # Run all tests with Vitest
bun test path/to/file   # Run specific test file
bun test -- --coverage  # Run with coverage report
```

Tests run against Docker containers and automatically backup/restore database state. Environment variables from `.env` are combined with `envs/.env.test`. Tests use Vitest for compatibility with the existing test suite.

### Building & Linting
```bash
bun run build           # Compile TypeScript
bun run lint            # Run ESLint
```

### Database Migrations
```bash
bun run migration:create    # Create new MikroORM migration
bun run migration:up        # Run pending migrations
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
