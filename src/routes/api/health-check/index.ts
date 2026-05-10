import { apiRouter } from '../../../lib/routing/router.js'

export function healthCheckAPIRouter() {
  return apiRouter('/v1/health-check', ({ route }) => {
    route({
      method: 'get',
      handler: () => {
        return {
          status: 204,
        }
      },
    })
  })
}
