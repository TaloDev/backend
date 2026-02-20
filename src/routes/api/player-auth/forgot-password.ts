import { getGlobalQueue } from '../../../config/global-queues'
import PlayerAuthResetPassword from '../../../emails/player-auth-reset-password-mail'
import { APIKeyScope } from '../../../entities/api-key'
import { PlayerAliasService } from '../../../entities/player-alias'
import PlayerAuth from '../../../entities/player-auth'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import generateSixDigitCode from '../../../lib/auth/generateSixDigitCode'
import queueEmail from '../../../lib/messaging/queueEmail'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { createPlayerAuthActivity, getRedisPasswordResetKey } from './common'
import { forgotPasswordDocs } from './docs'

export const forgotPasswordRoute = apiRoute({
  method: 'post',
  path: '/forgot_password',
  docs: forgotPasswordDocs,
  schema: (z) => ({
    body: z.object({
      email: z.string().meta({
        description:
          'The email address to send the verification code to. If no player with this email exists, the request will be ignored',
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { email } = ctx.state.validated.body
    const em = ctx.em

    const key = ctx.state.key

    const playerAuth = await em.repo(PlayerAuth).findOne(
      {
        email,
        player: {
          game: key.game,
        },
      },
      {
        populate: ['player.aliases', 'player.game'],
      },
    )

    if (playerAuth) {
      const redis = ctx.redis
      const alias = playerAuth.player.aliases.find(
        (alias) => alias.service === PlayerAliasService.TALO,
      )

      if (alias) {
        const code = generateSixDigitCode()
        await redis.set(getRedisPasswordResetKey(key, code), alias.id, 'EX', 900)
        await queueEmail(getGlobalQueue('email'), new PlayerAuthResetPassword(alias, code))

        createPlayerAuthActivity(ctx, playerAuth.player, {
          type: PlayerAuthActivityType.PASSWORD_RESET_REQUESTED,
        })

        await em.flush()
      }
    }

    return {
      status: 204,
    }
  },
})
