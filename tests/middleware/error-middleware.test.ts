import Koa from 'koa'
import request from 'supertest'
import { errorMiddleware } from '../../src/middleware/error-middleware'

vi.mock('@hyperdx/node-opentelemetry', () => ({ recordException: vi.fn() }))
vi.mock('@sentry/node', () => ({ withScope: vi.fn(), captureException: vi.fn() }))
vi.mock('@opentelemetry/api', () => ({ trace: { getActiveSpan: vi.fn() } }))

function buildApp(handler: Koa.Middleware) {
  const app = new Koa()
  app.use(errorMiddleware)
  app.use(handler)
  return app.callback()
}

describe('Error middleware', () => {
  describe('JWT errors (401 with originalError)', () => {
    it('returns the generic token message', async () => {
      const app = buildApp(() => {
        const err = Object.assign(new Error('jwt malformed'), {
          status: 401,
          originalError: new Error('jwt malformed'),
        })
        throw err
      })

      const res = await request(app).get('/').expect(401)
      expect(res.body.message).toBe('Please provide a valid token in the Authorization header')
    })
  })

  describe('non-JWT 4xx errors', () => {
    it('returns err.message in non-production', async () => {
      const app = buildApp((ctx) => ctx.throw(404, 'Player not found'))

      const res = await request(app).get('/').expect(404)
      expect(res.body.message).toBe('Player not found')
    })

    it('returns err.message in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const app = buildApp((ctx) => ctx.throw(400, 'Invalid input'))

      const res = await request(app).get('/').expect(400)
      expect(res.body.message).toBe('Invalid input')

      vi.unstubAllEnvs()
    })

    it('includes extra properties from ctx.throw', async () => {
      const app = buildApp((ctx) => ctx.throw(400, 'Invalid input', { errors: ['field required'] }))

      const res = await request(app).get('/').expect(400)
      expect(res.body.message).toBe('Invalid input')
      expect(res.body.errors).toStrictEqual(['field required'])
    })
  })

  describe('5xx errors', () => {
    it('returns err.message in non-production', async () => {
      const app = buildApp(() => {
        throw new Error('database exploded')
      })

      const res = await request(app).get('/').expect(500)
      expect(res.body.message).toBe('database exploded')
    })

    it('returns generic message in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const app = buildApp(() => {
        throw new Error('database exploded')
      })

      const res = await request(app).get('/').expect(500)
      expect(res.body.message).toBe('Something went wrong, please try again later')

      vi.unstubAllEnvs()
    })
  })
})
