import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import bcrypt from 'bcrypt'
import { createPlayerAuthActivity, loadAliasWithAuth } from './common'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { changePasswordDocs } from './docs'

export const changePasswordRoute = apiRoute({
  method: 'post',
  path: '/change_password',
  docs: changePasswordDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema
    }),
    body: z.object({
      currentPassword: z.string().meta({ description: 'The current password of the player' }),
      newPassword: z.string().meta({ description: 'The new password for the player' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth
  ),
  handler: async (ctx) => {
    const { currentPassword, newPassword } = ctx.state.validated.body
    const em = ctx.em

    const alias = ctx.state.alias
    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
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

    const isSamePassword = await bcrypt.compare(newPassword, alias.player.auth.password)
    if (isSamePassword) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
        extra: {
          errorCode: 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD'
        }
      })
      await em.flush()

      return ctx.throw(400, {
        message: 'Please choose a different password',
        errorCode: 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD'
      })
    }

    alias.player.auth.password = await bcrypt.hash(newPassword, 10)

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.CHANGED_PASSWORD
    })

    await em.flush()

    return {
      status: 204
    }
  }
})
