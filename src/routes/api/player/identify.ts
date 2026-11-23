import assert from 'node:assert'
import { z as zod } from 'zod'
import type { AppParameterizedContext } from '../../../lib/routing/context.js'
import type { APIRouteState } from '../../../lib/routing/state.js'
import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias.js'
import Player from '../../../entities/player.js'
import {
  CLAIM_KEY_HEADER,
  checkClaimKeyMatches,
  getClaimKey,
  throwInvalidClaimKey,
} from '../../../lib/auth/claim-key.js'
import { PricingPlanLimitError } from '../../../lib/billing/checkPricingPlanPlayerLimit.js'
import { hasProfanity } from '../../../lib/filters/profanity.js'
import {
  createPlayerFromIdentifyRequest,
  PlayerCreationError,
} from '../../../lib/players/createPlayer.js'
import { findAliasFromIdentifyRequest } from '../../../lib/players/findAlias.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import {
  claimKeyHeaderSchema,
  claimKeyHeaders,
} from '../../../lib/validation/playerHeadersSchema.js'
import { setCurrentPlayerState } from '../../../middleware/current-player-middleware.js'
import { validateAuthSessionToken } from '../../../middleware/player-auth-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { identifyDocs, claimableIdentifyDocs } from './docs.js'

type IdentifyInput = {
  service: string
  identifier: string
  storeClaimKey: boolean
}

function identifyFields(z: typeof zod, location: 'query' | 'body') {
  return {
    service: z
      .string({ error: `service is missing from the request ${location}` })
      .min(1, { message: 'Invalid service, must be a non-empty string' })
      .meta({
        description:
          'The name of the service where the identity of the player comes from (e.g. "steam", "epic" or "username")',
      }),
    identifier: z
      .string({ error: `identifier is missing from the request ${location}` })
      .min(1, { message: 'Invalid identifier, must be a non-empty string' })
      .meta({
        description:
          'The unique identifier of the player. This can be their username, an email or a numeric ID',
      }),
  }
}

async function identifyPlayer(
  ctx: AppParameterizedContext<APIRouteState>,
  { service: rawService, identifier, storeClaimKey }: IdentifyInput,
) {
  const em = ctx.em

  const service = rawService.trim().toLowerCase()

  const key = ctx.state.key
  const game = key.game
  const claimKey = getClaimKey(ctx)

  if (game.blockAliasIdentifierProfanity && hasProfanity(identifier)) {
    return ctx.throw(400, {
      message: 'Alias identifier contains inappropriate language',
      errorCode: 'IDENTIFIER_PROFANITY',
    })
  }

  let alias: PlayerAlias | null = null
  let justCreated = false
  let identityProven = false

  try {
    const resolved = await PlayerAlias.resolveIdentifier({
      em,
      game: key.game,
      service,
      identifier,
    })

    // only an integration that accepted the identifier or Talo session tokens can
    // prove that an identity is claimed
    identityProven = resolved.verified || PlayerAlias.isClaimKeyExempt(service)

    alias = await findAliasFromIdentifyRequest({
      em,
      key,
      service,
      identifier: resolved.identifier,
    })

    if (!alias) {
      if (service === PlayerAliasService.TALO) {
        return ctx.throw(
          404,
          'Player not found: Talo aliases must be created using the /v1/players/auth API',
        )
      } else {
        const player = await createPlayerFromIdentifyRequest({
          em,
          key,
          service,
          identifier: resolved.identifier,
          initialProps: resolved.initialPlayerProps,
          devBuild: ctx.state.devBuild,
        })
        alias = player.aliases[0]
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
        errorCode: err.errorCode,
        field: err.field,
        rejectedProps: err.rejectedProps,
      })
    }
    if (err instanceof PricingPlanLimitError) {
      return ctx.throw(402, err.message)
    }
    // catches steam integration errors
    if (err instanceof Error && typeof err.cause === 'number') {
      return ctx.throw(err.cause, err.message)
    }
    throw err
  }

  // the alias should have either been created or loaded at this point
  // if not we probably already threw an error above
  assert(alias)

  const player = alias.player

  // a claim key can only be set for a newly-created player or one where
  // the integration proved their identity
  const adoptsClaimKey =
    storeClaimKey &&
    claimKey &&
    player.claimKey === null &&
    !PlayerAlias.isClaimKeyExempt(alias.service) &&
    (justCreated || identityProven)

  if (adoptsClaimKey) {
    await em.repo(Player).nativeUpdate({ id: player.id, claimKey: null }, { claimKey })
    await em.refreshOrFail(player)
  }

  // the player must hold the key from this request, including when another
  // request claimed them between our read and our write
  if (!identityProven && !checkClaimKeyMatches(player, claimKey)) {
    return throwInvalidClaimKey(ctx)
  }

  if (!justCreated) {
    alias.lastSeenAt = player.lastSeenAt = new Date()
    await em.flush()
    await player.checkGroupMemberships(em)
  }

  const socketToken = await alias.createSocketToken(ctx.redis)

  return {
    status: 200,
    body: {
      alias,
      socketToken,
    },
  }
}

export const identifyRoute = apiRoute({
  method: 'get',
  path: '/identify',
  docs: identifyDocs,
  schema: (z) => ({
    query: z.object(identifyFields(z, 'query')),
    headers: claimKeyHeaders,
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS])),
  handler: (ctx) => {
    const { service, identifier } = ctx.state.validated.query

    return identifyPlayer(ctx, {
      service,
      identifier,
      storeClaimKey: false,
    })
  },
})

export const claimableIdentifyRoute = apiRoute({
  method: 'post',
  path: '/identify',
  docs: claimableIdentifyDocs,
  schema: (z) => ({
    body: z.object(identifyFields(z, 'body')),
    headers: zod.looseObject({
      [CLAIM_KEY_HEADER]: claimKeyHeaderSchema.meta({
        description: `When creating a player this becomes their claim key, otherwise it must match their existing one`,
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS])),
  handler: (ctx) => {
    const { service, identifier } = ctx.state.validated.body

    return identifyPlayer(ctx, {
      service,
      identifier,
      storeClaimKey: true,
    })
  },
})
