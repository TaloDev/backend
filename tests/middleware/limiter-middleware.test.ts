import type { Context } from 'koa'
import {
  getMaxRequestsForPath,
  isRateLimitedPublicRoute,
} from '../../src/middleware/limiter-middleware.js'

describe('Limiter middleware', () => {
  describe('getMaxRequestsForPath', () => {
    it.each([
      ['auth', 30, '/v1/players/auth'],
      ['auth', 30, '/v1/players/identify'],
      ['auth', 30, '/v1/socket-tickets'],
      ['default', 300, '/v1/events'],
      ['playerPublic', 10, '/public/players/abc/game'],
      ['auth', 30, '/public/users/reset_password'],
      ['auth', 30, '/public/users/forgot_password'],
    ])(
      'limit map key %s should allow %i requests per second for the path %s',
      async (limitMapKey, maxRequests, path) => {
        expect(getMaxRequestsForPath(path)).toStrictEqual({
          limitMapKey,
          maxRequests,
        })
      },
    )
  })

  describe('isRateLimitedPublicRoute', () => {
    it.each([
      [true, '/public/users/reset_password'],
      [true, '/public/users/forgot_password'],
      [true, '/public/users/login'],
      [true, '/public/players/some-id/game'],
      [false, '/public/users'],
      [false, '/public/health-check'],
      [false, '/public/webhooks/subscriptions'],
      [false, '/games/1/players'],
    ])('should return %s for the path %s', (expected, path) => {
      expect(isRateLimitedPublicRoute({ path } as Context)).toBe(expected)
    })
  })
})
