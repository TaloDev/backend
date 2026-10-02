import { getMaxRequestsForPath } from '../../src/middleware/limiter-middleware.js'

describe('Limiter middleware', () => {
  describe('getMaxRequestsForPath', () => {
    it.each([
      ['auth', 30, '/v1/players/auth'],
      ['auth', 30, '/v1/players/identify'],
      ['auth', 30, '/v1/socket-tickets'],
      ['default', 300, '/v1/events'],
      ['playerPublic', 10, '/public/players/abc/game'],
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
})
