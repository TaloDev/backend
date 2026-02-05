import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { PlayerAliasService } from '../../../entities/player-alias'
import bcrypt from 'bcrypt'
import generateSixDigitCode from '../../../lib/auth/generateSixDigitCode'
import queueEmail from '../../../lib/messaging/queueEmail'
import PlayerAuthCode from '../../../emails/player-auth-code-mail'
import { createPlayerAuthActivity, getRedisAuthKey, handleFailedLogin } from './common'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { findAliasFromIdentifyRequest } from '../../../lib/players/findAlias'
import { getGlobalQueue } from '../../../config/global-queues'
import { loginDocs } from './docs'

export const loginRoute = apiRoute({
  method: 'post',
  path: '/login',
  docs: loginDocs,
  schema: (z) => ({
    body: z.object({
      identifier: z.string().meta({ description: 'The unique identifier of the player. This can be their username, an email or a numeric ID' }),
      password: z.string().meta({ description: 'The player\'s password' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  ),
  handler: async (ctx) => {
    const { identifier, password } = ctx.state.validated.body
    const em = ctx.em

    const key = ctx.state.key

    const alias = await findAliasFromIdentifyRequest({
      em,
      key,
      service: PlayerAliasService.TALO,
      identifier
    })
    if (!alias) return handleFailedLogin(ctx)

    await em.populate(alias, ['player.auth'])
    if (!alias.player.auth) return handleFailedLogin(ctx)

    const passwordMatches = await bcrypt.compare(password, alias.player.auth.password)
    if (!passwordMatches) return handleFailedLogin(ctx)

    const redis = ctx.redis

    if (alias.player.auth.verificationEnabled) {
      await em.populate(alias.player, ['game'])

      const code = generateSixDigitCode()
      await redis.set(getRedisAuthKey(key, alias), code, 'EX', 300)
      await queueEmail(getGlobalQueue('email'), new PlayerAuthCode(alias, code))

      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.VERIFICATION_STARTED
      })

      await em.flush()

      return {
        status: 200,
        body: {
          aliasId: alias.id,
          verificationRequired: true
        }
      }
    } else {
      const sessionToken = await alias.player.auth.createSession(alias)
      const socketToken = await alias.createSocketToken(redis)

      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.LOGGED_IN
      })

      await em.flush()

      return {
        status: 200,
        body: {
          alias,
          sessionToken,
          socketToken
        }
      }
    }
  }
})
