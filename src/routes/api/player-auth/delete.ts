import type { EntityManager } from '@mikro-orm/mysql'
import bcrypt from 'bcrypt'
import assert from 'node:assert'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import PlayerAuth from '../../../entities/player-auth'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { buildPlayerAuthActivity } from '../../../lib/logging/buildPlayerAuthActivity'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { sessionHeaderSchema } from '../../../lib/validation/sessionHeaderSchema'
import { requireScopes } from '../../../middleware/policy-middleware'
import { deleteClickHousePlayerData } from '../../../tasks/deletePlayers'
import { loadAliasWithAuth } from './common'
import { deleteDocs } from './docs'

export async function performDelete({
  em,
  alias,
  ip,
  userAgent,
}: {
  em: EntityManager
  alias: PlayerAlias
  ip: string
  userAgent?: string
}) {
  await em.repo(PlayerAuthActivity).nativeDelete({ player: alias.player })

  await em.transactional(async (trx) => {
    buildPlayerAuthActivity({
      em: trx,
      player: alias.player,
      type: PlayerAuthActivityType.DELETED_AUTH,
      ip,
      userAgent,
      extra: { identifier: alias.identifier },
    })

    assert(alias.player.auth)
    trx.remove(trx.repo(PlayerAuth).getReference(alias.player.auth.id))
    trx.remove(trx.repo(PlayerAlias).getReference(alias.id))

    await deleteClickHousePlayerData({
      playerIds: [alias.player.id],
      aliasIds: [alias.id],
    })
  })

  return { status: 204 }
}

export async function deleteHandler({
  em,
  alias,
  currentPassword,
  ip,
  userAgent,
}: {
  em: EntityManager
  alias: PlayerAlias
  currentPassword: string
  ip: string
  userAgent?: string
}) {
  if (!alias.player.auth) {
    return { status: 400, body: { message: 'Player does not have authentication' } }
  }

  const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
  if (!passwordMatches) {
    buildPlayerAuthActivity({
      em,
      player: alias.player,
      type: PlayerAuthActivityType.DELETE_AUTH_FAILED,
      ip,
      userAgent,
      extra: { errorCode: 'INVALID_CREDENTIALS' },
    })
    await em.flush()

    return {
      status: 403,
      body: { message: 'Current password is incorrect', errorCode: 'INVALID_CREDENTIALS' },
    }
  }

  return performDelete({ em, alias, ip, userAgent })
}

export const deleteRoute = apiRoute({
  method: 'delete',
  docs: deleteDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
      'x-talo-alias': playerAliasHeaderSchema,
      'x-talo-session': sessionHeaderSchema,
    }),
    body: z.object({
      currentPassword: z.string().meta({ description: 'The current password of the player' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]),
    loadAliasWithAuth,
  ),
  handler: async (ctx) => {
    const { currentPassword } = ctx.state.validated.body

    return deleteHandler({
      em: ctx.em,
      alias: ctx.state.alias,
      currentPassword,
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
    })
  },
})
