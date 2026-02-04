import { EntityManager, FilterQuery } from '@mikro-orm/mysql'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import GameChannel from '../../../entities/game-channel'
import { subscriptionsDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'

export const subscriptionsRoute = apiRoute({
  method: 'get',
  path: '/subscriptions',
  docs: subscriptionsDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    query: z.object({
      propKey: z.string().optional().meta({ description: 'Only return channels with this prop key' }),
      propValue: z.string().optional().meta({ description: 'Only return channels with a matching prop key and value' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS]),
    loadAlias
  ),
  handler: async (ctx) => {
    const { propKey, propValue } = ctx.state.validated.query
    const em: EntityManager = ctx.em

    const aliasId = ctx.state.alias.id

    const where: FilterQuery<GameChannel> = {
      members: {
        $some: {
          id: aliasId
        }
      }
    }

    if (propKey) {
      if (propValue) {
        where.props = {
          $some: {
            key: propKey,
            value: propValue
          }
        }
      } else {
        where.props = {
          $some: {
            key: propKey
          }
        }
      }
    }

    const channels = await em.repo(GameChannel).find(where)

    return {
      status: 200,
      body: {
        channels: await Promise.all(channels.map((channel) => channel.toJSONWithCount(ctx.state.includeDevData)))
      }
    }
  }
})
