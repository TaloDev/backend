# Contributing

Want to add a new system? Are the docs not clear enough? We're always accepting contributions so please share any new features, improvements or bug fixes with us.

## Installation

1. Clone the repo and run `npm install`.
2. Copy `envs/.env.dev` to the project root and rename it to `.env`.
3. Run `npm run up` to spin up the Docker Compose containers.
4. The backend will be accessible via `http://localhost:3000`.

## Seeding data

Run `npm run seed` to seed your database with some fake data like users, events, games and players.

The seed command will create two users: `admin@trytalo.com` (an admin user) and `dev@trytalo.com` (a dev user with less permissions), both can be logged in with using the password `password`.

## Testing

Run `npm test` to run the unit tests.

The tests run against your database container. They'll automatically backup and restore the current state of your database before executing the tests.

Your `.env` file will be used along with any additional env vars you define in `envs/.env.test`.

Please make sure to include tests with all pull requests.

## Migrations

To create a migration, use `npm run migration:create`. This will create a migration class in the `migrations` folder.

Modify the default name of the file from `Migration[Timestamp].ts` to `[Timestamp][PascalCaseDescriptionOfTheMigration].ts`.

You should also rename the exported class to be `[PascalCaseDescriptionOfTheMigration]`.

You will then need to import and add that migration class to the end of the list of migrations inside `index.ts` in the same folder.

### ClickHouse migrations

ClickHouse migrations are created in the `src/migrations/clickhouse` folder. These are manually created and should be added to the `src/migrations/clickhouse/index.ts` file. The migration script will automatically run the migration if it hasn't already been applied.
