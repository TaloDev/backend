import type { EntityManager } from '@mikro-orm/mysql'
import type { Redis } from 'ioredis'
import bcrypt from 'bcrypt'
import assert from 'node:assert'
import { getGlobalQueue } from '../../../config/global-queues.js'
import PlayerAuthCode from '../../../emails/player-auth-code-mail.js'
import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerAlias from '../../../entities/player-alias.js'
import { PlayerAliasService } from '../../../entities/player-alias.js'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity.js'
import generateSixDigitCode from '../../../lib/auth/generateSixDigitCode.js'
import { buildPlayerAuthActivity } from '../../../lib/logging/buildPlayerAuthActivity.js'
import queueEmail from '../../../lib/messaging/queueEmail.js'
import { findAliasFromIdentifyRequest } from '../../../lib/players/findAlias.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { getRedisAuthKey, sessionBuilder as defaultSessionBuilder } from './common.js'
import { loginDocs } from './docs.js'

export async function loginHandler({
  em,
  alias,
  password,
  redis,
  ip,
  userAgent,
  sessionBuilder = defaultSessionBuilder,
  selfService,
  withRefresh,
}: {
  alias: PlayerAlias | null
  password: string
  em: EntityManager
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
      status: 401,
      body: { message: 'Incorrect identifier or password', errorCode: 'INVALID_CREDENTIALS' },
    }
  }

  await em.populate(alias, ['player.auth'])
  assert(alias.player.auth)

  const passwordMatches = await bcrypt.compare(password, alias.player.auth.password)
  if (!passwordMatches) {
    return {
      status: 401,
      body: { message: 'Incorrect identifier or password', errorCode: 'INVALID_CREDENTIALS' },
    }
  }

  if (alias.player.auth.verificationEnabled) {
    const code = generateSixDigitCode()
    await redis.set(getRedisAuthKey(alias), code, 'EX', 300)
    await queueEmail(getGlobalQueue('email'), new PlayerAuthCode(alias, code))

    buildPlayerAuthActivity({
      em,
      player: alias.player,
      type: PlayerAuthActivityType.VERIFICATION_STARTED,
      ip,
      userAgent,
      selfService,
    })

    await em.flush()

    return {
      status: 200,
      body: {
        aliasId: alias.id,
        verificationRequired: true,
      },
    }
  } else {
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
      body: {
        alias,
        sessionToken,
        refreshToken,
        socketToken,
      },
    }
  }
}

export const loginRoute = apiRoute({
  method: 'post',
  path: '/login',
  docs: loginDocs,
  schema: (z) => ({
    body: z.object({
      identifier: z.string().meta({
        description:
          'The unique identifier of the player. This can be their username, an email or a numeric ID',
      }),
      password: z.string().meta({ description: "The player's password" }),
      withRefresh: z.boolean().optional().meta({
        description:
          'When true, the response will include a refreshToken alongside a short-lived sessionToken',
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { identifier, password, withRefresh } = ctx.state.validated.body
    const em = ctx.em
    const key = ctx.state.key

    const alias = await findAliasFromIdentifyRequest({
      em,
      key,
      service: PlayerAliasService.TALO,
      identifier,
    })

    return loginHandler({
      em,
      alias,
      password,
      redis: ctx.redis,
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
      withRefresh,
    })
  },
})
