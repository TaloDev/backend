import bcrypt from 'bcrypt'
import { APIKeyScope } from '../../../entities/api-key'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import emailRegex from '../../../lib/lang/emailRegex'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { requireScopes } from '../../../middleware/policy-middleware'
import { createPlayerAuthActivity, loadAliasWithAuth } from './common'
import { toggleVerificationDocs } from './docs'

export const toggleVerificationRoute = apiRoute({
  method: 'patch',
  path: '/toggle_verification',
  docs: toggleVerificationDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema,
    }),
    body: z.object({
      currentPassword: z.string().meta({ description: 'The current password of the player' }),
      verificationEnabled: z
        .boolean()
        .meta({ description: 'The new verification status for the player account' }),
      email: z
        .string()
        .optional()
        .meta({
          description:
            'Required when attempting to enable verification if the player does not currently have an email address set',
        }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth,
  ),
  handler: async (ctx) => {
    const { currentPassword, verificationEnabled, email } = ctx.state.validated.body
    const em = ctx.em

    const alias = ctx.state.alias
    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    if (verificationEnabled && !alias.player.auth.email && !email) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
        extra: {
          errorCode: 'VERIFICATION_EMAIL_REQUIRED',
          verificationEnabled: Boolean(verificationEnabled),
        },
      })
      await em.flush()

      return ctx.throw(400, {
        message: 'An email address is required to enable verification',
        errorCode: 'VERIFICATION_EMAIL_REQUIRED',
      })
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS',
          verificationEnabled: Boolean(verificationEnabled),
        },
      })
      await em.flush()

      return ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS',
      })
    }

    alias.player.auth.verificationEnabled = Boolean(verificationEnabled)
    if (email?.trim()) {
      const sanitisedEmail = email.trim().toLowerCase()
      if (emailRegex.test(sanitisedEmail)) {
        alias.player.auth.email = sanitisedEmail
      } else {
        createPlayerAuthActivity(ctx, alias.player, {
          type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
          extra: {
            errorCode: 'INVALID_EMAIL',
            verificationEnabled: Boolean(verificationEnabled),
          },
        })
        await em.flush()

        return ctx.throw(400, {
          message: 'Invalid email address',
          errorCode: 'INVALID_EMAIL',
        })
      }
    }

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.VERIFICATION_TOGGLED,
      extra: {
        verificationEnabled: alias.player.auth.verificationEnabled,
      },
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
