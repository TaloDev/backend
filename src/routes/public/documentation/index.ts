import { publicRouter } from '../../../lib/routing/router'

export function documentationRouter() {
  return publicRouter('/public/docs', ({ route }) => {
    route({
      method: 'get',
      handler: () => {
        return {
          status: 200,
          body: {
            docs: {
              services: globalThis.talo.docs.getServices()
            }
          }
        }
      }
    })
  })
}
