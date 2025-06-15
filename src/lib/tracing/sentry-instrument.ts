import { init as initSentry } from '@sentry/node'

initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENV,
  maxValueLength: 4096,
  skipOpenTelemetrySetup: true
})
