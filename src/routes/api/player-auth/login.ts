import type { EntityManager } from '@mikro-orm/mysql'
import type Redis from 'ioredis'
import bcrypt from 'bcrypt'
import assert from 'node:assert'
import { getGlobalQueue } from '../../../config/global-queues'
import PlayerAuthCode from '../../../emails/player-auth-code-mail'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import { PlayerAliasService } from '../../../entities/player-alias'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import generateSixDigitCode from '../../../lib/auth/generateSixDigitCode'
import { buildPlayerAuthActivity } from '../../../lib/logging/buildPlayerAuthActivity'
import queueEmail from '../../../lib/messaging/queueEmail'
import { findAliasFromIdentifyRequest } from '../../../lib/players/findAlias'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { getRedisAuthKey, sessionBuilder as defaultSessionBuilder } from './common'
import { loginDocs } from './docs'

export async function loginHandler({
  em,
  alias,
  password,
  redis,
  ip,
  userAgent,
  sessionBuilder = defaultSessionBuilder,
  selfService,
}: {
  alias: PlayerAlias | null
  password: string
  em: EntityManager
  redis: Redis
  ip: string
  userAgent?: string
  sessionBuilder?: (alias: PlayerAlias) => Promise<string>
  selfService?: boolean
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
    const sessionToken = await sessionBuilder(alias)
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
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { identifier, password } = ctx.state.validated.body
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
    })
  },
})
