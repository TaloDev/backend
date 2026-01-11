import { publicRouter } from '../../../lib/routing/router'

export function healthCheckRouter() {
  return publicRouter('/public', ({ route }) => {
    route({
      method: 'get',
      path: '/health',
      handler: () => {
        return {
          status: 204
        }
      }
    })
  })
}
