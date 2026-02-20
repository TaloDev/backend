import bcrypt from 'bcrypt'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { createPlayerAuthActivity, getRedisPasswordResetKey } from './common'
import { resetPasswordDocs } from './docs'

export const resetPasswordRoute = apiRoute({
  method: 'post',
  path: '/reset_password',
  docs: resetPasswordDocs,
  schema: (z) => ({
    body: z.object({
      code: z.string().meta({
        description: 'The 6-digit verification code sent to the email address (must be a string)',
      }),
      password: z.string().meta({ description: 'The new password for the player' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { password, code } = ctx.state.validated.body
    const em = ctx.em

    const key = ctx.state.key

    const redis = ctx.redis
    const aliasId = await redis.get(getRedisPasswordResetKey(key, code))
    const alias = await em.repo(PlayerAlias).findOne(
      {
        id: Number(aliasId),
        player: {
          game: ctx.state.game,
        },
      },
      {
        populate: ['player.auth'],
      },
    )

    if (!aliasId || !alias || !alias.player.auth) {
      return ctx.throw(401, {
        message: 'This code is either invalid or has expired',
        errorCode: 'PASSWORD_RESET_CODE_INVALID',
      })
    }

    await redis.del(getRedisPasswordResetKey(key, code))

    alias.player.auth.password = await bcrypt.hash(password, 10)
    alias.player.auth.clearSession()

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.PASSWORD_RESET_COMPLETED,
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
