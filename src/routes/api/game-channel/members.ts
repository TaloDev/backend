import { FilterQuery } from '@mikro-orm/mysql'
import { APIKeyScope } from '../../../entities/api-key'
import Player from '../../../entities/player'
import PlayerAlias from '../../../entities/player-alias'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadChannel } from './common'
import { membersDocs } from './docs'

export const membersRoute = apiRoute({
  method: 'get',
  path: '/:id/members',
  docs: membersDocs,
  schema: (z) => ({
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the channel' }),
    }),
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    query: z.object({
      page: pageSchema.meta({ description: 'The current pagination index (starting at 0)' }),
      playerId: z.uuid().optional().meta({ description: 'Filter members by this player ID' }),
      aliasId: numericStringSchema
        .optional()
        .meta({ description: 'Find a member with this player alias ID' }),
      identifier: z.string().optional().meta({ description: 'Find a member with this identifier' }),
      playerPropKey: z
        .string()
        .optional()
        .meta({ description: 'Filter members by players with this prop key' }),
      playerPropValue: z
        .string()
        .optional()
        .meta({ description: 'Filter members by players with matching prop keys and values' }),
      playerGroupId: z
        .uuid()
        .optional()
        .meta({ description: 'Filter members by players in this group' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_CHANNELS]),
    loadAlias,
    loadChannel,
  ),
  handler: async (ctx) => {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const { page, playerId, aliasId, identifier, playerPropKey, playerPropValue, playerGroupId } =
      ctx.state.validated.query
    const em = ctx.em

    const channel = ctx.state.channel
    const alias = ctx.state.alias

    if (!channel.hasMember(alias.id)) {
      return ctx.throw(403, 'This player is not a member of the channel')
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
            value: playerPropValue,
          },
        }
      } else {
        playerFilter.props = {
          $some: {
            key: playerPropKey,
          },
        }
      }
    }

    if (playerGroupId) {
      playerFilter.groups = {
        $some: playerGroupId,
      }
    }

    const where: FilterQuery<PlayerAlias> = {
      channels: {
        $some: channel,
      },
      player: playerFilter,
    }

    if (aliasId) {
      where.id = aliasId
    }
    if (identifier) {
      where.identifier = identifier
    }

    const [members, count] = await em.repo(PlayerAlias).findAndCount(where, {
      limit: itemsPerPage + 1,
      offset: page * itemsPerPage,
    })

    return {
      status: 200,
      body: {
        members: members.slice(0, itemsPerPage),
        count,
        itemsPerPage,
        isLastPage: members.length <= itemsPerPage,
      },
    }
  },
})
