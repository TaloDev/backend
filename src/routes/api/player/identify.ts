import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import { validateAuthSessionToken } from '../../../middleware/player-auth-middleware'
import { setCurrentPlayerState } from '../../../middleware/current-player-middleware'
import { createPlayerFromIdentifyRequest, PlayerCreationError } from '../../../lib/players/createPlayer'
import { PricingPlanLimitError } from '../../../lib/billing/checkPricingPlanPlayerLimit'
import { findAliasFromIdentifyRequest } from '../../../lib/players/findAlias'
import { identifyDocs } from './docs'
import assert from 'node:assert'

export const identifyRoute = apiRoute({
  method: 'get',
  path: '/identify',
  docs: identifyDocs,
  schema: (z) => ({
    query: z.object({
      service: z.string({ error: 'service is missing from the request query' })
        .min(1, { message: 'Invalid service, must be a non-empty string' })
        .meta({ description: 'The name of the service where the identity of the player comes from (e.g. "steam", "epic" or "username")' }),
      identifier: z.string({ error: 'identifier is missing from the request query' })
        .min(1, { message: 'Invalid identifier, must be a non-empty string' })
        .meta({ description: 'The unique identifier of the player. This can be their username, an email or a numeric ID' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS])
  ),
  handler: async (ctx) => {
    const { service, identifier } = ctx.state.validated.query
    const em = ctx.em

    const key = ctx.state.key
    let alias: PlayerAlias | null = null
    let justCreated = false

    try {
      const resolved = await PlayerAlias.resolveIdentifier({
        em,
        game: key.game,
        service,
        identifier
      })

      alias = await findAliasFromIdentifyRequest({ em, key, service, identifier: resolved.identifier })
      if (!alias) {
        if (service === PlayerAliasService.TALO) {
          return ctx.throw(404, 'Player not found: Talo aliases must be created using the /v1/players/auth API')
        } else {
          const player = await createPlayerFromIdentifyRequest({
            em,
            key,
            service,
            identifier: resolved.identifier,
            initialProps: resolved.initialPlayerProps,
            devBuild: ctx.state.devBuild
          })
          alias = player?.aliases[0]
          justCreated = true
        }
      } else if (alias.service === PlayerAliasService.TALO) {
        setCurrentPlayerState(ctx, alias.player.id, alias.id)
        await em.populate(alias, ['player.auth'])
        await validateAuthSessionToken(ctx, alias)
      }
    } catch (err) {
      if (err instanceof PlayerCreationError) {
        return ctx.throw(err.statusCode, {
          message: err.message,
          errorCode: err.errorCode
        })
      }
      if (err instanceof PricingPlanLimitError) {
        return ctx.throw(402, err.message)
      }
      // catches steam integration errors
      if (err instanceof Error && err.cause === 400) {
        return ctx.throw(400, err.message)
      }
      throw err
    }

    // the alias should have either been created or loaded at this point
    // if not we probably already threw an error above
    assert(alias)

    if (!justCreated) {
      alias.lastSeenAt = alias.player.lastSeenAt = new Date()
      await em.flush()
      await alias.player.checkGroupMemberships(em)
    }

    const socketToken = await alias.createSocketToken(ctx.redis)

    return {
      status: 200,
      body: {
        alias,
        socketToken
      }
    }
  }
})
