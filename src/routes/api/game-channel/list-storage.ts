import Redis from 'ioredis'
import { APIKeyScope } from '../../../entities/api-key'
import GameChannelStorageProp from '../../../entities/game-channel-storage-prop'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadChannel } from './common'
import { listStorageDocs } from './docs'

type FlattenedProp = ReturnType<typeof GameChannelStorageProp.flatten>

export const listStorageRoute = apiRoute({
  method: 'get',
  path: '/:id/storage/list',
  docs: listStorageDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    query: z.object({
      propKeys: z
        .union(
          [z.string(), z.array(z.string())], // allow one string or an array of strings
          { error: 'propKeys is missing from the request query' },
        )
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .refine((arr) => arr.length > 0, { error: 'At least one key must be provided' })
        .refine((arr) => arr.length <= 50, { error: 'Maximum 50 keys allowed per request' })
        .refine((arr) => arr.every((key) => typeof key === 'string' && key.trim().length > 0), {
          error: 'All keys must be non-empty strings',
        })
        .meta({ description: 'An array of storage property keys to retrieve (maximum 50 keys)' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS]),
    loadAlias,
    loadChannel,
  ),
  handler: async (ctx) => {
    const { propKeys } = ctx.state.validated.query
    const em = ctx.em
    const channel = ctx.state.channel
    const redis: Redis = ctx.redis

    if (!channel.hasMember(ctx.state.alias.id)) {
      return ctx.throw(403, 'This player is not a member of the channel')
    }

    const redisKeys = propKeys.map((key) => GameChannelStorageProp.getRedisKey(channel.id, key))
    const cachedValues = await redis.mget(...redisKeys)

    const resultMap = new Map<string, FlattenedProp>()
    const missingKeys: string[] = []

    cachedValues.forEach((cached, index) => {
      const key = propKeys[index]
      if (cached) {
        resultMap.set(key, JSON.parse(cached))
      } else {
        missingKeys.push(key)
      }
    })

    if (missingKeys.length > 0) {
      const propsFromDB = await em.repo(GameChannelStorageProp).find({
        gameChannel: channel,
        key: { $in: missingKeys },
      })

      const propsByKey = new Map<string, GameChannelStorageProp[]>()
      for (const prop of propsFromDB) {
        const group = propsByKey.get(prop.key) ?? []
        group.push(prop)
        propsByKey.set(prop.key, group)
      }

      const pipeline = redis.pipeline()

      for (const key of missingKeys) {
        const rows = propsByKey.get(key) ?? []
        const flattened = GameChannelStorageProp.flatten(rows)
        resultMap.set(key, flattened)
        const redisKey = GameChannelStorageProp.getRedisKey(channel.id, key)
        const expirationSeconds = GameChannelStorageProp.redisExpirationSeconds
        pipeline.set(redisKey, JSON.stringify(flattened), 'EX', expirationSeconds)
      }

      await pipeline.exec()
    }

    const props = propKeys.flatMap((key) => {
      const prop = resultMap.get(key)
      return prop ? [prop] : []
    })

    return {
      status: 200,
      body: {
        props,
      },
    }
  },
})
