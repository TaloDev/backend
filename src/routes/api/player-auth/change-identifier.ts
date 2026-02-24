import bcrypt from 'bcrypt'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { requireScopes } from '../../../middleware/policy-middleware'
import { createPlayerAuthActivity, loadAliasWithAuth } from './common'
import { changeIdentifierDocs } from './docs'

export const changeIdentifierRoute = apiRoute({
  method: 'post',
  path: '/change_identifier',
  docs: changeIdentifierDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema,
    }),
    body: z.object({
      currentPassword: z.string().meta({ description: 'The current password of the player' }),
      newIdentifier: z.string().meta({ description: 'The new identifier for the player' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth,
  ),
  handler: async (ctx) => {
    const { currentPassword, newIdentifier } = ctx.state.validated.body
    const em = ctx.em

    const alias = ctx.state.alias
    if (!alias.player.auth) {
      return ctx.throw(400, 'Player does not have authentication')
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_IDENTIFIER_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS',
        },
      })
      await em.flush()

      return ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS',
      })
    }

    const sanitisedIdentifier = newIdentifier.trim().toLowerCase()

    if (sanitisedIdentifier === alias.identifier) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_IDENTIFIER_FAILED,
        extra: {
          errorCode: 'NEW_IDENTIFIER_MATCHES_CURRENT_IDENTIFIER',
        },
      })
      await em.flush()

      return ctx.throw(400, {
        message: 'Please choose a different identifier',
        errorCode: 'NEW_IDENTIFIER_MATCHES_CURRENT_IDENTIFIER',
      })
    }

    const matchingIdentifierCount = await em.repo(PlayerAlias).count({
      identifier: sanitisedIdentifier,
      player: {
        game: ctx.state.key.game,
      },
    })

    if (matchingIdentifierCount > 0) {
      createPlayerAuthActivity(ctx, alias.player, {
        type: PlayerAuthActivityType.CHANGE_IDENTIFIER_FAILED,
        extra: {
          errorCode: 'IDENTIFIER_TAKEN',
        },
      })
      await em.flush()

      return ctx.throw(400, {
        message: 'This identifier is already taken',
        errorCode: 'IDENTIFIER_TAKEN',
      })
    }

    const oldIdentifier = alias.identifier
    alias.identifier = sanitisedIdentifier

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.CHANGED_IDENTIFIER,
      extra: {
        oldIdentifier,
      },
    })

    await em.flush()

    return {
      status: 204,
    }
  },
})
