import { LockMode } from '@mikro-orm/mysql'
import Redis from 'ioredis'
import { APIKeyScope } from '../../../entities/api-key'
import GameChannelStorageProp from '../../../entities/game-channel-storage-prop'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import { sanitiseProps, testPropSize } from '../../../lib/props/sanitiseProps'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadChannel } from './common'
import { putStorageDocs } from './docs'

type GameChannelStorageTransaction = {
  upsertedProps: GameChannelStorageProp[]
  deletedProps: GameChannelStorageProp[]
  failedProps: { key: string; error: string }[]
}

export const putStorageRoute = apiRoute({
  method: 'put',
  path: '/:id/storage',
  docs: putStorageDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    body: z.object({
      props: z
        .array(
          z.object({
            key: z.string(),
            value: z.string().nullable(),
          }),
          { error: 'Props must be an array' },
        )
        .meta({
          description:
            'An array of storage properties to create or update. Set value to null to delete a property.',
        }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_CHANNELS]),
    loadAlias,
    loadChannel,
  ),
  handler: async (ctx) => {
    const { props } = ctx.state.validated.body
    const em = ctx.em

    const channel = ctx.state.channel

    if (!channel.hasMember(ctx.state.alias.id)) {
      return ctx.throw(403, 'This player is not a member of the channel')
    }

    const { upsertedProps, deletedProps, failedProps } = await em.transactional(
      async (trx): Promise<GameChannelStorageTransaction> => {
        const newPropsMap = new Map(sanitiseProps({ props }).map(({ key, value }) => [key, value]))

        const upsertedProps: GameChannelStorageTransaction['upsertedProps'] = []
        const deletedProps: GameChannelStorageTransaction['deletedProps'] = []
        const failedProps: GameChannelStorageTransaction['failedProps'] = []

        if (newPropsMap.size === 0) {
          return {
            upsertedProps,
            deletedProps,
            failedProps,
          }
        }

        const existingStorageProps = await trx.repo(GameChannelStorageProp).find(
          {
            gameChannel: channel,
            key: {
              $in: Array.from(newPropsMap.keys()),
            },
          },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        )

        for (const existingProp of existingStorageProps) {
          const newPropValue = newPropsMap.get(existingProp.key)
          newPropsMap.delete(existingProp.key)

          if (!newPropValue) {
            // delete the existing prop and track who deleted it
            trx.remove(existingProp)
            existingProp.lastUpdatedBy = ctx.state.alias
            existingProp.updatedAt = new Date()
            deletedProps.push(existingProp)
            continue
          } else {
            try {
              testPropSize({ key: existingProp.key, value: newPropValue })
            } catch (error) {
              if (error instanceof PropSizeError) {
                failedProps.push({ key: existingProp.key, error: error.message })
                continue
                /* v8 ignore next 3 -- @preserve */
              } else {
                throw error
              }
            }

            // update the existing prop
            existingProp.value = String(newPropValue)
            existingProp.lastUpdatedBy = ctx.state.alias
            newPropsMap.delete(existingProp.key)
            upsertedProps.push(existingProp)
          }
        }

        for (const [key, value] of newPropsMap.entries()) {
          if (value) {
            try {
              testPropSize({ key, value })
            } catch (error) {
              if (error instanceof PropSizeError) {
                failedProps.push({ key, error: error.message })
                continue
                /* v8 ignore next 3 -- @preserve */
              } else {
                throw error
              }
            }

            // create a new prop
            const newProp = new GameChannelStorageProp(channel, key, String(value))
            newProp.createdBy = ctx.state.alias
            newProp.lastUpdatedBy = ctx.state.alias
            trx.persist(newProp)
            upsertedProps.push(newProp)
          }
        }

        const redis: Redis = ctx.redis
        for (const prop of upsertedProps) {
          await prop.persistToRedis(redis)
        }
        for (const prop of deletedProps) {
          const redisKey = GameChannelStorageProp.getRedisKey(channel.id, prop.key)
          const expirationSeconds = GameChannelStorageProp.redisExpirationSeconds
          await redis.set(redisKey, 'null', 'EX', expirationSeconds)
        }

        return {
          upsertedProps,
          deletedProps,
          failedProps,
        }
      },
    )

    await channel.sendMessageToMembers(ctx.wss, 'v1.channels.storage.updated', {
      channel,
      upsertedProps,
      deletedProps,
    })

    return {
      status: 200,
      body: {
        channel,
        upsertedProps,
        deletedProps,
        failedProps,
      },
    }
  },
})
