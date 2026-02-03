import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { RouteDocs } from '../../../lib/docs/docs-registry'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'

const docs: RouteDocs = {
  description: 'Update a player\'s online status and custom status',
  samples: [
    {
      title: 'Sample request',
      sample: {
        online: true,
        customStatus: 'In a match'
      }
    },
    {
      title: 'Sample response',
      sample: {
        presence: {
          online: true,
          customStatus: 'In a match',
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

export const putRoute = apiRoute({
  method: 'put',
  docs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    body: z.object({
      online: z.boolean().optional().meta({ description: 'Whether the player is online' }),
      customStatus: z.string().optional().meta({ description: 'A custom status message for the player' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_PLAYER_PRESENCE]),
    loadAlias
  ),
  handler: async (ctx) => {
    const { online, customStatus } = ctx.state.validated.body
    const em = ctx.em

    const playerAlias = ctx.state.alias
    const player = playerAlias.player

    await player.setPresence(em, ctx.wss, playerAlias, online, customStatus)

    return {
      status: 200,
      body: {
        presence: player.presence
      }
    }
  }
})
