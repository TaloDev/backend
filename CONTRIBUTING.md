# Contributing

Want to add a new system? Are the docs not clear enough? We're always accepting contributions so please share any new features, improvements or bug fixes with us.

## Installation

1. Clone the repo and run `yarn` or `npm install`.
2. Copy `envs/.env.dev` to the project root and rename it to `.env`.
3. Run `yarn up` (or `npm run up`) to spin up the Docker Compose containers.
4. The backend will be accessible via `http://localhost:3000`.

## Testing

Run `yarn test` (or `npm test`) to run the Jest unit tests.

The tests run against your database container. They'll automatically backup and restore the current state of your database before executing the tests.

Your `.env` file will be used along with any additional env vars you define in `envs/.env.test`.

Please make sure to include tests with all pull requests.

## Creating new services

You can create a new service using the `yarn service:create` command. You need to pass in the name of the entity you want the service to interact with.

For example, if you are adding a "Global Stats" service, you would run: `yarn service:create global-stat` (note that the entity name is singular and not a plural).

This will create a policy, entity and REST API for your new entity. If you want to expose API endpoints (so that it can be used by the Unity SDK), add `--api` to the end of the command.

## Migrations

To create a migration, use `yarn migration:create`. This will create a migration class in the `migrations` folder. You will then need to import that migration class into the `index.ts` in the same folder.