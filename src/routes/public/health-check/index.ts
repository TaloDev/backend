import { publicRouter } from '../../../lib/routing/router'

export function healthCheckRouter() {
  return publicRouter('/public/health', ({ route }) => {
    route({
      method: 'get',
      handler: () => {
        return {
          status: 204
        }
      }
    })
  })
}
