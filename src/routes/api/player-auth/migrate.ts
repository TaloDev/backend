import bcrypt from 'bcrypt'
import assert from 'node:assert'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import PlayerAuth from '../../../entities/player-auth'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { throwPlayerAuthError } from '../../../lib/errors/throwPlayerAuthError'
import { buildPlayerAuthActivity } from '../../../lib/logging/buildPlayerAuthActivity'
import { findAliasFromIdentifyRequest } from '../../../lib/players/findAlias'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadAliasWithAuth } from './common'
import { migrateDocs } from './docs'

export const migrateRoute = apiRoute({
  method: 'post',
  path: '/migrate',
  docs: migrateDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema,
    }),
    body: z.object({
      currentPassword: z.string().meta({ description: 'The current password of the player' }),
      service: z
        .string()
        .min(1)
        .meta({ description: 'The service to migrate to (e.g. steam or google_play_games)' }),
      identifier: z.string().min(1).meta({ description: 'The new identifier for the player' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth,
  ),
  handler: async (ctx) => {
    const { currentPassword, service, identifier } = ctx.state.validated.body
    const em = ctx.em
    const alias = ctx.state.alias
    const key = ctx.state.key

    assert(alias.player.auth)

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      return throwPlayerAuthError({
        ctx,
        status: 403,
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS',
      })
    }

    if (service.toLowerCase().trim() === PlayerAliasService.TALO) {
      return throwPlayerAuthError({
        ctx,
        status: 400,
        message: 'Cannot migrate to the Talo service',
        errorCode: 'INVALID_MIGRATION_TARGET',
      })
    }

    const { identifier: resolvedIdentifier } = await PlayerAlias.resolveIdentifier({
      em,
      game: key.game,
      service,
      identifier,
    })

    const ip = ctx.request.ip
    const userAgent = ctx.request.headers['user-agent']
    const oldIdentifier = alias.identifier

    await em.transactional(async (trx) => {
      const trimmedService = service.trim()

      const existingAlias = await findAliasFromIdentifyRequest({
        em: trx,
        key,
        service,
        identifier: resolvedIdentifier,
      })

      if (existingAlias) {
        return throwPlayerAuthError({
          ctx,
          status: 409,
          message: 'A player already exists with this identifier',
          errorCode: 'IDENTIFIER_TAKEN',
        })
      }

      await trx.repo(PlayerAuthActivity).nativeDelete({ player: alias.player })

      buildPlayerAuthActivity({
        em: trx,
        player: alias.player,
        type: PlayerAuthActivityType.MIGRATED_AUTH,
        ip,
        userAgent,
        extra: {
          oldIdentifier,
          newService: trimmedService,
        },
      })

      assert(alias.player.auth)
      trx.remove(trx.repo(PlayerAuth).getReference(alias.player.auth.id))

      alias.service = trimmedService
      alias.identifier = resolvedIdentifier
    })

    return {
      status: 200,
      body: {
        alias,
      },
    }
  },
})
