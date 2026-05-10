import jwt from 'jsonwebtoken'
import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias.js'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity.js'
import { verify } from '../../../lib/auth/jwt.js'
import { throwPlayerAuthError } from '../../../lib/errors/throwPlayerAuthError.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { createPlayerAuthActivity } from './common.js'
import { refreshDocs } from './docs.js'

export const refreshRoute = apiRoute({
  method: 'post',
  path: '/refresh',
  docs: refreshDocs,
  schema: (z) => ({
    body: z.object({
      refreshToken: z
        .string()
        .meta({ description: 'The refresh token issued after a successful login or registration' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { refreshToken } = ctx.state.validated.body
    const em = ctx.em

    const decoded = jwt.decode(refreshToken) as {
      playerId?: string
      aliasId?: number
      type?: string
    } | null

    if (!decoded?.aliasId || !decoded?.playerId || decoded.type !== 'refresh') {
      return throwPlayerAuthError({
        ctx,
        status: 401,
        message: 'Invalid refresh token',
        errorCode: 'INVALID_SESSION',
      })
    }

    const alias = await em.repo(PlayerAlias).findOne(
      {
        id: decoded.aliasId,
        service: PlayerAliasService.TALO,
        player: {
          id: decoded.playerId,
          game: ctx.state.game,
        },
      },
      { populate: ['player.auth'] },
    )

    if (!alias?.player.auth?.sessionKey) {
      return throwPlayerAuthError({
        ctx,
        status: 401,
        message: 'Invalid refresh token',
        errorCode: 'INVALID_SESSION',
      })
    }

    try {
      await verify<{ playerId: string; aliasId: number }>(
        refreshToken,
        `${alias.player.auth.sessionKey}:refresh`,
      )
    } catch {
      return throwPlayerAuthError({
        ctx,
        status: 401,
        message: 'Invalid refresh token',
        errorCode: 'INVALID_SESSION',
      })
    }

    const { sessionToken, refreshToken: newRefreshToken } = await alias.player.auth.createSession(
      alias,
      true,
    )

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.SESSION_REFRESHED,
    })

    await em.flush()

    return {
      status: 200,
      body: { sessionToken, refreshToken: newRefreshToken },
    }
  },
})
