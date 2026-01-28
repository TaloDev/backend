import PlayerAuthActivity from '../../../entities/player-auth-activity'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { loadPlayer } from './common'
import { loadGame } from '../../../middleware/game-middleware'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'

export const authActivitiesRoute = protectedRoute({
  method: 'get',
  path: '/:id/auth-activities',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'view player auth activities'),
    loadGame,
    loadPlayer
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const player = ctx.state.player

    const hasTaloAlias = await em.repo(PlayerAlias).count({
      player,
      service: PlayerAliasService.TALO
    }) > 0

    let activities: PlayerAuthActivity[] = []
    if (hasTaloAlias) {
      activities = await em.repo(PlayerAuthActivity).find({ player })
    }

    return {
      status: 200,
      body: {
        activities
      }
    }
  }
})
