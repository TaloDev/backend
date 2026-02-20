# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Talo is a self-hostable game development services platform providing leaderboards, player authentication, peer-to-peer multiplayer, event tracking, and more. The backend is built with Koa (Node.js web framework) using `koa-tree-router` for routing.

### Testing

```bash
npm test                # Run all tests with Vitest
npm test path/to/file   # Run specific test file
npm test -- --coverage  # Run with coverage report
```

Tests run against fresh Docker containers. Environment variables from `.env` are combined with `envs/.env.test`.

### Building & Linting

```bash
npm run lint -- --check   # Run Oxlint + type-checker
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

Middleware executes in order (see `src/index.ts`).

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
  player: { game: ctx.state.game }, // game already in Identity Map
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

## Common Patterns

### Adding a New API Endpoint

Use the `/new-route` skill for step-by-step guidance on creating routes.

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
  return ctx.throw(404, 'Player not found') // return ensures type narrowing
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

## Important Conventions

- Entity names are singular (Player, not Players)
- Router functions are named `[feature]Router` or `[feature]APIRouter`
- Test files end with `.test.ts`
- Migration files: `[Timestamp][PascalCaseDescription].ts`
- Use lazy loading for entity relationships to avoid circular dependencies
- API endpoints require scope checks via `requireScopes()` middleware
- Protected endpoints require user type checks via `userTypeGate()` or `ownerGate()` middleware
