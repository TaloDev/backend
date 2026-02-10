import Redis from 'ioredis'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { loadChannel } from './common'
import GameChannelStorageProp from '../../../entities/game-channel-storage-prop'
import { listStorageDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'

export const listStorageRoute = apiRoute({
  method: 'get',
  path: '/:id/storage/list',
  docs: listStorageDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' })
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    query: z.object({
      propKeys: z.union(
        [z.string(), z.array(z.string())], // allow one string or an array of strings
        { error: 'propKeys is missing from the request query' }
      )
        .transform((val) => Array.isArray(val) ? val : [val])
        .refine((arr) => arr.length > 0, { error: 'At least one key must be provided' })
        .refine((arr) => arr.length <= 50, { error: 'Maximum 50 keys allowed per request' })
        .refine((arr) => arr.every((key) => typeof key === 'string' && key.trim().length > 0), { error: 'All keys must be non-empty strings' })
        .meta({ description: 'An array of storage property keys to retrieve (maximum 50 keys)' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS]),
    loadAlias,
    loadChannel
  ),
  handler: async (ctx) => {
    const { propKeys } = ctx.state.validated.query
    const em = ctx.em
    const channel = ctx.state.channel
    const redis: Redis = ctx.redis

    if (!channel.hasMember(ctx.state.alias.id)) {
      ctx.throw(403, 'This player is not a member of the channel')
    }

    const keys = propKeys
    const redisKeys = keys.map((key) => GameChannelStorageProp.getRedisKey(channel.id, key))
    const cachedProps = await redis.mget(...redisKeys)

    const resultMap = new Map<string, GameChannelStorageProp>()
    const missingKeys: string[] = []

    cachedProps.forEach((cachedProp, index) => {
      const originalKey = keys[index]
      if (cachedProp) {
        resultMap.set(originalKey, JSON.parse(cachedProp))
      } else {
        missingKeys.push(originalKey)
      }
    })

    if (missingKeys.length > 0) {
      const propsFromDB = await em.repo(GameChannelStorageProp).find({
        gameChannel: channel,
        key: { $in: missingKeys }
      })

      // cache the results using a single operation
      if (propsFromDB.length > 0) {
        const pipeline = redis.pipeline()

        for (const prop of propsFromDB) {
          resultMap.set(prop.key, prop)
          const redisKey = GameChannelStorageProp.getRedisKey(channel.id, prop.key)
          const expirationSeconds = GameChannelStorageProp.redisExpirationSeconds
          pipeline.set(redisKey, JSON.stringify(prop), 'EX', expirationSeconds)
        }

        await pipeline.exec()
      }
    }

    const props = keys.map((key) => resultMap.get(key))
      .filter((prop): prop is GameChannelStorageProp => prop !== undefined)

    return {
      status: 200,
      body: {
        props
      }
    }
  }
})
