# Talo backend

Talo's backend is a set of self-hostable services that helps you build games faster and make better decisions.

## Features
- Event tracking
- Player management (including identity and cross-session data)

### In progress
- Global stats (track unique or aggregated stats e.g. total quests completed)

## Docs

Our docs are [available here](https://docs.trytalo.com).

## Self-hosting

See the [self-hosting docs](https://docs.trytalo.com/docs/selfhosting/overview) and the [self-hosting example repo](https://github.com/TaloDev/hosting).

## Installation

1. Clone the repo and run `yarn` or `npm install`.
2. Copy `envs/.env.dev` to the project root and rename it to `.env`.
3. Run `yarn up` (or `npm run up`) to spin up the Docker Compose containers.
4. The backend will be accessible via `http://localhost:3000`.

## Testing

Run `yarn test` (or `npm test`) to run the Jest unit tests.

The tests run against your database container. They'll automatically backup and restore the current state of your database before executing the tests.

Your `.env` file will be used along with any additional env vars you define in `envs/.env.test`.
