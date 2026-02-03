import { apiRouter } from '../../../lib/routing/router'
import { createSocketTicket } from '../../../lib/sockets/createSocketTicket'
import { RouteDocs } from 'koa-clay'

export function socketTicketAPIRouter() {
  return apiRouter('/v1/socket-tickets', ({ route }) => {
    route({
      method: 'post',
      docs,
      handler: async (ctx) => {
        const devBuild = ctx.headers['x-talo-dev-build'] === '1'
        const ticket = await createSocketTicket(ctx.redis, ctx.state.key, devBuild)

        return {
          status: 200,
          body: {
            ticket
          }
        }
      }
    })
  }, {
    docsKey: 'SocketTicketAPI'
  })
}

const docs = {
  description: 'Create a socket ticket (expires after 5 minutes)',
  samples: [
    {
      title: 'Sample response',
      sample: {
        ticket: '6c6ef345-0ac3-4edc-a221-b807fbbac4ac'
      }
    }
  ]
} satisfies RouteDocs
