import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { createPlayerAuthActivity, getRedisAuthKey } from './common'
import { verifyDocs } from './docs'

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
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { aliasId, code } = ctx.state.validated.body
    const em = ctx.em

    const key = ctx.state.key

    const alias = await em.repo(PlayerAlias).findOne(
      {
        id: aliasId,
        player: {
          game: ctx.state.game,
        },
      },
      {
        populate: ['player.auth'],
      },
    )

    if (!alias) {
      return ctx.throw(403, {
        message: 'Player alias not found',
        errorCode: 'VERIFICATION_ALIAS_NOT_FOUND',
      })
    }

    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    const redis = ctx.redis
    const redisCode = await redis.get(getRedisAuthKey(key, alias))

    if (!redisCode || code !== redisCode) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.VERIFICATION_FAILED,
      })
      await em.flush()

      return ctx.throw(403, {
        message: 'Invalid code',
        errorCode: 'VERIFICATION_CODE_INVALID',
      })
    }

    await redis.del(getRedisAuthKey(key, alias))

    const sessionToken = await alias.player.auth.createSession(alias)
    const socketToken = await alias.createSocketToken(redis)

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.LOGGED_IN,
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
  },
})
