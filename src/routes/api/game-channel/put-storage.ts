import { EntityManager } from '@mikro-orm/mysql'
import { Redis } from 'ioredis'
import type { RejectedProp } from '../../../lib/props/sanitiseProps.js'
import { APIKeyScope } from '../../../entities/api-key.js'
import GameChannelStorageProp from '../../../entities/game-channel-storage-prop.js'
import GameChannel from '../../../entities/game-channel.js'
import PlayerAlias from '../../../entities/player-alias.js'
import { withRedisLock } from '../../../lib/perf/redisLock.js'
import { filterProfaneProps } from '../../../lib/props/filterProfaneProps.js'
import {
  isArrayKey,
  MAX_ARRAY_LENGTH,
  sanitiseProps,
  testPropSize,
} from '../../../lib/props/sanitiseProps.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadChannel } from './common.js'
import { putStorageDocs } from './docs.js'

type TransactionResult = {
  upsertedProps: GameChannelStorageProp[]
  deletedProps: GameChannelStorageProp[]
  rejectedProps: RejectedProp[]
}

function processScalars(
  trx: EntityManager,
  alias: PlayerAlias,
  channel: GameChannel,
  newScalarMap: Map<string, string | null>,
  existingProps: GameChannelStorageProp[],
): Pick<TransactionResult, 'upsertedProps' | 'deletedProps' | 'rejectedProps'> {
  const upsertedProps: GameChannelStorageProp[] = []
  const deletedProps: GameChannelStorageProp[] = []
  const rejectedProps: RejectedProp[] = []

  const existingScalarMap = new Map(existingProps.map((p) => [p.key, p]))

  for (const [key, value] of newScalarMap.entries()) {
    const existingProp = existingScalarMap.get(key)

    if (!value) {
      if (existingProp) {
        trx.remove(existingProp)
        existingProp.lastUpdatedBy = alias
        existingProp.updatedAt = new Date()
        deletedProps.push(existingProp)
      }
      continue
    }

    const sizeRejection = testPropSize({ key, value })
    if (sizeRejection) {
      rejectedProps.push(sizeRejection)
      continue
    }

    if (existingProp) {
      existingProp.value = value
      existingProp.lastUpdatedBy = alias
      upsertedProps.push(existingProp)
    } else {
      const newProp = new GameChannelStorageProp(channel, key, value)
      newProp.createdBy = alias
      newProp.lastUpdatedBy = alias
      trx.persist(newProp)
      upsertedProps.push(newProp)
    }
  }

  return { upsertedProps, deletedProps, rejectedProps }
}

function processArrays(
  trx: EntityManager,
  alias: PlayerAlias,
  channel: GameChannel,
  newArrayMap: Map<string, (string | null)[]>,
  existingProps: GameChannelStorageProp[],
): Pick<TransactionResult, 'upsertedProps' | 'deletedProps' | 'rejectedProps'> {
  const upsertedProps: GameChannelStorageProp[] = []
  const deletedProps: GameChannelStorageProp[] = []
  const rejectedProps: RejectedProp[] = []

  for (const [key, values] of newArrayMap.entries()) {
    const nonNullValues = [...new Set(values.filter((v): v is string => v !== null))]

    const keySizeRejection = testPropSize({ key, value: null })
    if (keySizeRejection) {
      rejectedProps.push(keySizeRejection)
      continue
    }

    const valueSizeRejection = nonNullValues
      .map((v) => testPropSize({ key, value: v }))
      .find(Boolean)
    if (valueSizeRejection) {
      rejectedProps.push(valueSizeRejection)
      continue
    }

    if (nonNullValues.length > MAX_ARRAY_LENGTH) {
      rejectedProps.push({
        key,
        error: 'PROP_ARRAY_TOO_LONG',
        message: `Prop array length (${nonNullValues.length}) for key '${key}' exceeds ${MAX_ARRAY_LENGTH} items`,
      })
      continue
    }

    const existingForKey = existingProps.filter((p) => p.key === key)
    const existingByValue = new Map(existingForKey.map((p) => [p.value, p]))
    const createdBy =
      existingForKey.length > 0
        ? [...existingForKey].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
            .createdBy
        : alias

    for (const existingProp of existingForKey) {
      if (!nonNullValues.includes(existingProp.value)) {
        trx.remove(existingProp)
        existingProp.lastUpdatedBy = alias
        existingProp.updatedAt = new Date()
        deletedProps.push(existingProp)
      }
    }

    for (const value of nonNullValues) {
      const existingProp = existingByValue.get(value)
      if (existingProp) {
        existingProp.lastUpdatedBy = alias
        upsertedProps.push(existingProp)
      } else {
        const newProp = new GameChannelStorageProp(channel, key, value)
        newProp.createdBy = createdBy
        newProp.lastUpdatedBy = alias
        trx.persist(newProp)
        upsertedProps.push(newProp)
      }
    }
  }

  return { upsertedProps, deletedProps, rejectedProps }
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
    const {
      em,
      redis,
      state: { alias, channel },
    } = ctx

    if (!channel.hasMember(alias.id)) {
      return ctx.throw(403, 'This player is not a member of the channel')
    }

    const sanitised = sanitiseProps({ props })
    const { accepted, rejected: profanityRejected } = filterProfaneProps(
      sanitised,
      ctx.state.game.blockPropsProfanity,
    )

    const {
      upsertedProps,
      deletedProps,
      rejectedProps: sizeRejected,
    } = await withRedisLock({ key: `locks:channel-storage:${channel.id}` }, () =>
      em.transactional(async (trx): Promise<TransactionResult> => {
        const newScalarMap = new Map<string, string | null>()
        const newArrayMap = new Map<string, (string | null)[]>()
        for (const { key, value } of accepted) {
          if (isArrayKey(key)) {
            const existing = newArrayMap.get(key) ?? []
            existing.push(value)
            newArrayMap.set(key, existing)
          } else {
            newScalarMap.set(key, value)
          }
        }

        if (newScalarMap.size === 0 && newArrayMap.size === 0) {
          return { upsertedProps: [], deletedProps: [], rejectedProps: [] }
        }

        const allIncomingKeys = [...newScalarMap.keys(), ...newArrayMap.keys()]
        const existingStorageProps = await trx
          .repo(GameChannelStorageProp)
          .find({ gameChannel: channel, key: { $in: allIncomingKeys } })

        const scalarResult = processScalars(
          trx,
          alias,
          channel,
          newScalarMap,
          existingStorageProps.filter((p) => !isArrayKey(p.key)),
        )
        const arrayResult = processArrays(
          trx,
          alias,
          channel,
          newArrayMap,
          existingStorageProps.filter((p) => isArrayKey(p.key)),
        )

        const upsertedProps = [...scalarResult.upsertedProps, ...arrayResult.upsertedProps]
        const deletedProps = [...scalarResult.deletedProps, ...arrayResult.deletedProps]
        const rejectedProps = [...scalarResult.rejectedProps, ...arrayResult.rejectedProps]

        const touchedKeys = new Set([...upsertedProps, ...deletedProps].map((p) => p.key))
        for (const key of touchedKeys) {
          const remaining = upsertedProps.filter((p) => p.key === key)
          await GameChannelStorageProp.persistToRedis({
            redis: redis as Redis,
            channelId: channel.id,
            key,
            props: remaining,
          })
        }

        return { upsertedProps, deletedProps, rejectedProps }
      }),
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
        failedProps: [...sizeRejected, ...profanityRejected],
      },
    }
  },
})
