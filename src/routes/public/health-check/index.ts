import { publicRouter } from '../../../lib/routing/router'

export function healthCheckRoutes() {
  return publicRouter('HealthCheck', '', ({ route }) => {
    route({
      method: 'get',
      path: '/health',
      handler: (c) => {
        return c.body(null, 204)
      }
    })
  })
}
