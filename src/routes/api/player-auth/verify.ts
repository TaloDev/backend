import type { EntityManager } from '@mikro-orm/mysql'
import type Redis from 'ioredis'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { buildPlayerAuthActivity } from '../../../lib/logging/buildPlayerAuthActivity'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { getRedisAuthKey, sessionBuilder as defaultSessionBuilder } from './common'
import { verifyDocs } from './docs'

export async function verifyHandler({
  em,
  alias,
  code,
  redis,
  ip,
  userAgent,
  sessionBuilder = defaultSessionBuilder,
  selfService,
  withRefresh,
}: {
  em: EntityManager
  alias: PlayerAlias | null
  code: string
  redis: Redis
  ip: string
  userAgent?: string
  sessionBuilder?: (
    alias: PlayerAlias,
    withRefresh?: boolean,
  ) => Promise<{ sessionToken: string; refreshToken?: string }>
  selfService?: boolean
  withRefresh?: boolean
}) {
  if (!alias) {
    return {
      status: 403,
      body: { message: 'Player alias not found', errorCode: 'VERIFICATION_ALIAS_NOT_FOUND' },
    }
  }

  if (!alias.player.auth) {
    return { status: 400, body: { message: 'Player does not have authentication' } }
  }

  const redisCode = await redis.get(getRedisAuthKey(alias))

  if (!redisCode || code !== redisCode) {
    buildPlayerAuthActivity({
      em,
      player: alias.player,
      type: PlayerAuthActivityType.VERIFICATION_FAILED,
      ip,
      userAgent,
      selfService,
    })
    await em.flush()

    return {
      status: 403,
      body: { message: 'Invalid code', errorCode: 'VERIFICATION_CODE_INVALID' },
    }
  }

  await redis.del(getRedisAuthKey(alias))

  const { sessionToken, refreshToken } = await sessionBuilder(alias, withRefresh)
  const socketToken = selfService ? undefined : await alias.createSocketToken(redis)

  buildPlayerAuthActivity({
    em,
    player: alias.player,
    type: PlayerAuthActivityType.LOGGED_IN,
    ip,
    userAgent,
    selfService,
  })

  await em.flush()

  return {
    status: 200,
    body: { alias, sessionToken, refreshToken, socketToken },
  }
}

export const verifyRoute = apiRoute({
  method: 'post',
  path: '/verify',
  docs: verifyDocs,
  schema: (z) => ({
    body: z.object({
      aliasId: z.number().meta({ description: 'The ID of the alias to verify' }),
      code: z.string().meta({
        description: 'The 6-digit verification code sent to the player (must be a string)',
      }),
      withRefresh: z.boolean().optional().meta({
        description:
          'When true, the response will include a refreshToken alongside a short-lived sessionToken',
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { aliasId, code, withRefresh } = ctx.state.validated.body
    const em = ctx.em

    const alias = await em.repo(PlayerAlias).findOne(
      {
        id: aliasId,
        player: { game: ctx.state.game },
      },
      { populate: ['player.auth'] },
    )

    return verifyHandler({
      em,
      alias,
      code,
      redis: ctx.redis,
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
      withRefresh,
    })
  },
})
