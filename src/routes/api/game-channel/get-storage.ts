import Redis from 'ioredis'
import { APIKeyScope } from '../../../entities/api-key'
import GameChannelStorageProp from '../../../entities/game-channel-storage-prop'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadChannel } from './common'
import { getStorageDocs } from './docs'

export const getStorageRoute = apiRoute({
  method: 'get',
  path: '/:id/storage',
  docs: getStorageDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    query: z.object({
      propKey: z.string().meta({ description: 'The key of the storage property to retrieve' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS]),
    loadAlias,
    loadChannel,
  ),
  handler: async (ctx) => {
    const { propKey } = ctx.state.validated.query
    const em = ctx.em

    const channel = ctx.state.channel

    if (!channel.hasMember(ctx.state.alias.id)) {
      return ctx.throw(403, 'This player is not a member of the channel')
    }

    let result: GameChannelStorageProp | null = null

    const redis: Redis = ctx.redis
    const cachedProp = await redis.get(GameChannelStorageProp.getRedisKey(channel.id, propKey))

    if (cachedProp) {
      return {
        status: 200,
        body: {
          prop: JSON.parse(cachedProp),
        },
      }
    }

    result = await em.repo(GameChannelStorageProp).findOne({
      gameChannel: channel,
      key: propKey,
    })

    if (result) {
      await result.persistToRedis(redis)
    }

    return {
      status: 200,
      body: {
        prop: result,
      },
    }
  },
})
