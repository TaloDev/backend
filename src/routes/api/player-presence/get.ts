import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import Player from '../../../entities/player'
import PlayerPresence from '../../../entities/player-presence'
import { RouteDocs } from '../../../lib/docs/docs-registry'

const docs: RouteDocs = {
  description: 'Get a player\'s online status and custom status',
  samples: [
    {
      title: 'Sample response',
      sample: {
        presence: {
          online: true,
          customStatus: 'I\'m loving this game',
          playerAlias: {
            id: 1,
            service: 'username',
            identifier: 'jimbo',
            player: {
              id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
              props: [
                { key: 'currentLevel', value: '58' },
                { key: 'xPos', value: '13.29' },
                { key: 'yPos', value: '26.44' },
                { key: 'zoneId', value: '3' }
              ],
              devBuild: false,
              createdAt: '2025-01-15T13:20:32.133Z',
              lastSeenAt: '2025-02-12T15:09:43.066Z',
              groups: []
            }
          },
          updatedAt: '2025-02-12T15:09:43.066Z'
        }
      }
    }
  ]
}

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs,
  schema: (z) => ({
    route: z.object({
      id: z.string().meta({ description: 'The ID of the player' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYER_PRESENCE])
  ),
  handler: async (ctx) => {
    const { id } = ctx.state.validated.route
    const em = ctx.em

    const player = await em.repo(Player).findOne({
      id,
      game: ctx.state.game
    })

    if (!player) {
      return ctx.throw(404, 'Player not found')
    }

    const presence = player.presence ?? new PlayerPresence(player)

    return {
      status: 200,
      body: {
        presence
      }
    }
  }
})
