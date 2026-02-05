import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import PlayerAuth from '../../../entities/player-auth'
import bcrypt from 'bcrypt'
import assert from 'node:assert'
import { createPlayerAuthActivity, loadAliasWithAuth } from './common'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { deleteClickHousePlayerData } from '../../../tasks/deletePlayers'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { deleteDocs } from './docs'

export const deleteRoute = apiRoute({
  method: 'delete',
  docs: deleteDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema
    }),
    body: z.object({
      currentPassword: z.string().meta({ description: 'The current password of the player' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth
  ),
  handler: async (ctx) => {
    const { currentPassword } = ctx.state.validated.body
    const em = ctx.em

    const alias = ctx.state.alias
    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.DELETE_AUTH_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS'
        }
      })
      await em.flush()

      return ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS'
      })
    }

    await em.repo(PlayerAuthActivity).nativeDelete({
      player: alias.player
    })

    await em.transactional(async (trx) => {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.DELETED_AUTH,
        extra: {
          identifier: alias.identifier
        }
      })

      assert(alias.player.auth)
      trx.remove(trx.repo(PlayerAuth).getReference(alias.player.auth.id))
      trx.remove(trx.repo(PlayerAlias).getReference(alias.id))

      await deleteClickHousePlayerData({
        playerIds: [alias.player.id],
        aliasIds: [alias.id]
      })
    })

    return {
      status: 204
    }
  }
})
