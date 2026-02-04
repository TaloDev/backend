import { EntityManager, FilterQuery } from '@mikro-orm/mysql'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { loadChannel } from './common'
import PlayerAlias from '../../../entities/player-alias'
import Player from '../../../entities/player'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { membersDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { pageSchema } from '../../../lib/validation/pageSchema'

export const membersRoute = apiRoute({
  method: 'get',
  path: '/:id/members',
  docs: membersDocs,
  schema: (z) => ({
    route: z.object({
      id: z.string().meta({ description: 'The ID of the channel' })
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    query: z.object({
      page: pageSchema.meta({ description: 'The current pagination index (starting at 0)' }),
      playerId: z.string().optional().meta({ description: 'Filter members by this player ID' }),
      aliasId: z.coerce.number().optional().meta({ description: 'Find a member with this player alias ID' }),
      identifier: z.string().optional().meta({ description: 'Find a member with this identifier' }),
      playerPropKey: z.string().optional().meta({ description: 'Filter members by players with this prop key' }),
      playerPropValue: z.string().optional().meta({ description: 'Filter members by players with matching prop keys and values' }),
      playerGroupId: z.string().optional().meta({ description: 'Filter members by players in this group' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS]),
    loadChannel,
    loadAlias
  ),
  handler: async (ctx) => {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const {
      page,
      playerId,
      aliasId,
      identifier,
      playerPropKey,
      playerPropValue,
      playerGroupId
    } = ctx.state.validated.query
    const em: EntityManager = ctx.em

    const channel = ctx.state.channel
    const alias = ctx.state.alias

    if (!channel.hasMember(alias.id)) {
      ctx.throw(403, 'This player is not a member of the channel')
    }

    const playerFilter: FilterQuery<Player> = ctx.state.includeDevData ? {} : { devBuild: false }

    if (playerId) {
      playerFilter.id = playerId
    }
    if (playerPropKey) {
      if (playerPropValue) {
        playerFilter.props = {
          $some: {
            key: playerPropKey,
            value: playerPropValue
          }
        }
      } else {
        playerFilter.props = {
          $some: {
            key: playerPropKey
          }
        }
      }
    }

    if (playerGroupId) {
      playerFilter.groups = {
        $some: playerGroupId
      }
    }

    const where: FilterQuery<PlayerAlias> = {
      channels: {
        $some: channel
      },
      player: playerFilter
    }

    if (aliasId) {
      where.id = aliasId
    }
    if (identifier) {
      where.identifier = identifier
    }

    const [members, count] = await em.repo(PlayerAlias).findAndCount(where, {
      limit: itemsPerPage + 1,
      offset: page * itemsPerPage
    })

    return {
      status: 200,
      body: {
        members: members.slice(0, itemsPerPage),
        count,
        itemsPerPage,
        isLastPage: members.length <= itemsPerPage
      }
    }
  }
})
