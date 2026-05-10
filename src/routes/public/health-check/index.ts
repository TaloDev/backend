import { publicRouter } from '../../../lib/routing/router.js'

export function healthCheckRouter() {
  return publicRouter('/public/health', ({ route }) => {
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
