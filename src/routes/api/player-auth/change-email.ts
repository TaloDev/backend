import bcrypt from 'bcrypt'
import { APIKeyScope } from '../../../entities/api-key'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { throwPlayerAuthError } from '../../../lib/errors/throwPlayerAuthError'
import emailRegex from '../../../lib/lang/emailRegex'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { requireScopes } from '../../../middleware/policy-middleware'
import { createPlayerAuthActivity, isEmailTakenForGame, loadAliasWithAuth } from './common'
import { changeEmailDocs } from './docs'

export const changeEmailRoute = apiRoute({
  method: 'post',
  path: '/change_email',
  docs: changeEmailDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema,
    }),
    body: z.object({
      currentPassword: z.string().meta({ description: 'The current password of the player' }),
      newEmail: z.string().meta({ description: 'The new email address for the player' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth,
  ),
  handler: async (ctx) => {
    const { currentPassword, newEmail } = ctx.state.validated.body
    const em = ctx.em

    const alias = ctx.state.alias
    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS',
        },
      })
      await em.flush()

      return throwPlayerAuthError({
        ctx,
        status: 403,
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS',
      })
    }

    const sanitisedEmail = newEmail.trim().toLowerCase()
    const isSameEmail = sanitisedEmail === alias.player.auth.email
    if (isSameEmail) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: 'NEW_EMAIL_MATCHES_CURRENT_EMAIL',
        },
      })
      await em.flush()

      return throwPlayerAuthError({
        ctx,
        status: 400,
        message: 'Please choose a different email address',
        errorCode: 'NEW_EMAIL_MATCHES_CURRENT_EMAIL',
      })
    }

    const oldEmail = alias.player.auth.email
    if (emailRegex.test(sanitisedEmail)) {
      if (await isEmailTakenForGame(em, { email: sanitisedEmail, game: ctx.state.game })) {
        createPlayerAuthActivity(ctx, alias.player, {
          type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
          extra: {
            errorCode: 'EMAIL_TAKEN',
          },
        })
        await em.flush()

        return throwPlayerAuthError({
          ctx,
          status: 400,
          message: 'This email address is already in use',
          errorCode: 'EMAIL_TAKEN',
        })
      }
      alias.player.auth.email = sanitisedEmail
    } else {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: 'INVALID_EMAIL',
        },
      })
      await em.flush()

      return throwPlayerAuthError({
        ctx,
        status: 400,
        message: 'Invalid email address',
        errorCode: 'INVALID_EMAIL',
      })
    }

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.CHANGED_EMAIL,
      extra: {
        oldEmail,
      },
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
