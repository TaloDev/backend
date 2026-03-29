import { EntityManager, LockMode } from '@mikro-orm/mysql'
import Redis from 'ioredis'
import { APIKeyScope } from '../../../entities/api-key'
import GameChannel from '../../../entities/game-channel'
import GameChannelStorageProp from '../../../entities/game-channel-storage-prop'
import PlayerAlias from '../../../entities/player-alias'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import {
  isArrayKey,
  MAX_ARRAY_LENGTH,
  sanitiseProps,
  testPropSize,
} from '../../../lib/props/sanitiseProps'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadChannel } from './common'
import { putStorageDocs } from './docs'

type FailedProp = { key: string; error: string }

type TransactionResult = {
  upsertedProps: GameChannelStorageProp[]
  deletedProps: GameChannelStorageProp[]
  failedProps: FailedProp[]
}

function tryTestPropSize(key: string, value: string | null): string | null {
  try {
    testPropSize({ key, value })
    return null
  } catch (error) {
    if (error instanceof PropSizeError) {
      return error.message
    }
    /* v8 ignore next 2 -- @preserve */
    throw error
  }
}

function processScalars(
  trx: EntityManager,
  alias: PlayerAlias,
  channel: GameChannel,
  newScalarMap: Map<string, string | null>,
  existingProps: GameChannelStorageProp[],
): Pick<TransactionResult, 'upsertedProps' | 'deletedProps' | 'failedProps'> {
  const upsertedProps: GameChannelStorageProp[] = []
  const deletedProps: GameChannelStorageProp[] = []
  const failedProps: FailedProp[] = []

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

    const sizeError = tryTestPropSize(key, value)
    if (sizeError) {
      failedProps.push({ key, error: sizeError })
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

  return { upsertedProps, deletedProps, failedProps }
}

function processArrays(
  trx: EntityManager,
  alias: PlayerAlias,
  channel: GameChannel,
  newArrayMap: Map<string, (string | null)[]>,
  existingProps: GameChannelStorageProp[],
): Pick<TransactionResult, 'upsertedProps' | 'deletedProps' | 'failedProps'> {
  const upsertedProps: GameChannelStorageProp[] = []
  const deletedProps: GameChannelStorageProp[] = []
  const failedProps: FailedProp[] = []

  for (const [key, values] of newArrayMap.entries()) {
    const nonNullValues = [...new Set(values.filter((v): v is string => v !== null))]

    const keySizeError = tryTestPropSize(key, null)
    if (keySizeError) {
      failedProps.push({ key, error: keySizeError })
      continue
    }

    const valueSizeError = nonNullValues.map((v) => tryTestPropSize(key, v)).find(Boolean)
    if (valueSizeError) {
      failedProps.push({ key, error: valueSizeError })
      continue
    }

    if (nonNullValues.length > MAX_ARRAY_LENGTH) {
      failedProps.push({
        key,
        error: `Prop array length (${nonNullValues.length}) for key '${key}' exceeds ${MAX_ARRAY_LENGTH} items`,
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

  return { upsertedProps, deletedProps, failedProps }
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

    const { upsertedProps, deletedProps, failedProps } = await em.transactional(
      async (trx): Promise<TransactionResult> => {
        const sanitised = sanitiseProps({ props })

        const newScalarMap = new Map<string, string | null>()
        const newArrayMap = new Map<string, (string | null)[]>()
        for (const { key, value } of sanitised) {
          if (isArrayKey(key)) {
            const existing = newArrayMap.get(key) ?? []
            existing.push(value)
            newArrayMap.set(key, existing)
          } else {
            newScalarMap.set(key, value)
          }
        }

        if (newScalarMap.size === 0 && newArrayMap.size === 0) {
          return { upsertedProps: [], deletedProps: [], failedProps: [] }
        }

        const allIncomingKeys = [...newScalarMap.keys(), ...newArrayMap.keys()]
        const existingStorageProps = await trx
          .repo(GameChannelStorageProp)
          .find(
            { gameChannel: channel, key: { $in: allIncomingKeys } },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          )

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
        const failedProps = [...scalarResult.failedProps, ...arrayResult.failedProps]

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

        return { upsertedProps, deletedProps, failedProps }
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
