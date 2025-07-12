import { getMaxRequestsForPath } from '../../src/middleware/limiter-middleware'

describe('getMaxRequestsForPath', () => {
  it.each([
    ['auth', 5, '/v1/players/auth'],
    ['auth', 5, '/v1/players/identify'],
    ['auth', 5, '/v1/socket-tickets'],
    ['default', 50, '/v1/events']
  ])('limit map key %s should allow %i requests per second for the path %s', async (limitMapKey, maxRequests, path) => {
    expect(getMaxRequestsForPath(path)).toStrictEqual({
      limitMapKey,
      maxRequests
    })
  })
})
