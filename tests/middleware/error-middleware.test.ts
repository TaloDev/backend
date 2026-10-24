import jwt from 'jsonwebtoken'
import Koa from 'koa'
import request from 'supertest'
import { canCaptureJWTError, errorMiddleware } from '../../src/middleware/error-middleware.js'

vi.mock('@opentelemetry/api', () => ({ trace: { getActiveSpan: vi.fn() } }))

function buildApp(handler: Koa.Middleware) {
  const app = new Koa()
  app.use(errorMiddleware)
  app.use(handler)
  return app.callback()
}

const SECRET = 'secret'

function thrown(fn: () => unknown) {
  try {
    fn()
  } catch (err) {
    return err as Error
  }
  throw new Error('expected the call to throw')
}

// the real errors jsonwebtoken throws for each kind of bad token, so a
// message can't drift from what the library actually emits
const filteredErrors: [string, Error][] = [
  ['expired token', thrown(() => jwt.verify(jwt.sign({}, SECRET, { expiresIn: -10 }), SECRET))],
  [
    'token not yet active',
    thrown(() => jwt.verify(jwt.sign({ nbf: Math.floor(Date.now() / 1000) + 60 }, SECRET), SECRET)),
  ],
  ['invalid signature', thrown(() => jwt.verify(jwt.sign({}, SECRET), 'other-secret'))],
  ['malformed token', thrown(() => jwt.verify('not-a-token', SECRET))],
  ['invalid token', thrown(() => jwt.verify('!!!.@@@.###', SECRET))],
  [
    'missing signature',
    thrown(() => jwt.verify(`${jwt.sign({}, SECRET).split('.').slice(0, 2).join('.')}.`, SECRET)),
  ],
  ['revoked token', new Error('Token revoked')],
  ['unresolved api key', new Error('Secret not provided')],
]

function throwJWTError(originalError: Error) {
  return () => {
    throw Object.assign(new Error('Authentication Error'), {
      status: 401,
      originalError,
    })
  }
}

describe('Error middleware', () => {
  describe('JWT errors (401 with originalError)', () => {
    it('returns the generic token message', async () => {
      const app = buildApp(throwJWTError(new jwt.JsonWebTokenError('jwt malformed')))

      const res = await request(app).get('/').expect(401)
      expect(res.body.message).toBe('Please provide a valid token in the Authorization header')
    })

    // junk tokens from scanners, truncated signatures and stale tokens are noise
    it.each(filteredErrors)('does not report a %s', async (_case, originalError) => {
      expect(canCaptureJWTError(originalError)).toBe(false)

      const app = buildApp(throwJWTError(originalError))
      const res = await request(app).get('/').expect(401)

      expect(res.body.message).toBe('Please provide a valid token in the Authorization header')
    })

    it('reports errors that are not token verification failures', () => {
      expect(canCaptureJWTError(new Error('API_SECRET must be 32 characters long'))).toBe(true)
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
