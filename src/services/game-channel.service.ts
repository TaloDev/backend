import { EntityManager, QueryOrder } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route, Validate } from 'koa-clay'
import GameChannel from '../entities/game-channel'
import GameChannelPolicy from '../policies/game-channel.policy'
import { GameActivityType } from '../entities/game-activity'
import createGameActivity from '../lib/logging/createGameActivity'
import { hardSanitiseProps, mergeAndSanitiseProps } from '../lib/props/sanitiseProps'
import PlayerAlias from '../entities/player-alias'
import { PropSizeError } from '../lib/errors/propSizeError'
import buildErrorResponse from '../lib/errors/buildErrorResponse'
import { captureException } from '@sentry/node'
import { pageValidation } from '../lib/pagination/pageValidation'
import { DEFAULT_PAGE_SIZE } from '../lib/pagination/itemsPerPage'
import { withResponseCache } from '../lib/perf/responseCache'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'
import Game from '../entities/game'

const itemsPerPage = DEFAULT_PAGE_SIZE

export default class GameChannelService extends Service {
  @Route({
    method: 'GET'
  })
  @Validate({
    query: {
      page: pageValidation
    }
  })
  @HasPermission(GameChannelPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { search, page = 0, propKey, propValue } = req.query
    const em: EntityManager = req.ctx.em

    const game: Game = req.ctx.state.game
    const searchComponent = search ? encodeURIComponent(search) : 'no-search'
    const cacheKey = `${GameChannel.getSearchCacheKey(game)}-${searchComponent}-${page}-${propKey}-${propValue}`

    return withResponseCache({
      key: cacheKey,
      ttl: 600
    }, async () => {
      const query = em.qb(GameChannel, 'gc')
        .select('gc.*')
        .orderBy({ totalMessages: QueryOrder.DESC })
        .limit(itemsPerPage + 1)
        .offset(Number(page) * itemsPerPage)

      if (search) {
        query.andWhere({
          $or: [
            { name: { $like: `%${search}%` } },
            {
              owner: { identifier: { $like: `%${search}%` } }
            }
          ]
        })
      }

      if (req.ctx.state.user.api) {
        query.andWhere({
          private: false
        })
      }

      if (propKey) {
        if (propValue) {
          query.andWhere({
            props: {
              $some: {
                key: propKey,
                value: propValue
              }
            }
          })
        } else {
          query.andWhere({
            props: {
              $some: {
                key: propKey
              }
            }
          })
        }
      }

      const [channels, count] = await query
        .andWhere({ game })
        .getResultAndCount()

      await em.populate(channels, ['owner'])

      const channelPromises = channels.slice(0, itemsPerPage)
        .map((channel) => channel.toJSONWithCount(req.ctx.state.includeDevData))

      return {
        status: 200,
        body: {
          channels: await Promise.all(channelPromises),
          count,
          itemsPerPage,
          isLastPage: channels.length <= itemsPerPage
        }
      }
    })
  }

  @Route({
    method: 'POST'
  })
  @Validate({ body: [GameChannel] })
  @HasPermission(GameChannelPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, props, autoCleanup, private: isPrivate, ownerAliasId, temporaryMembership } = req.body
    const em: EntityManager = req.ctx.em

    const channel = new GameChannel(req.ctx.state.game)
    channel.name = name
    channel.autoCleanup = autoCleanup ?? false
    channel.private = isPrivate ?? false
    channel.temporaryMembership = temporaryMembership ?? false

    if (req.ctx.state.alias) {
      channel.owner = req.ctx.state.alias
      channel.members.add(req.ctx.state.alias)
    }

    if (ownerAliasId) {
      const owner = await em.getRepository(PlayerAlias).findOne({
        id: ownerAliasId,
        player: { game: req.ctx.state.game }
      })

      if (!owner) {
        req.ctx.throw(404, 'Owner not found')
      }

      channel.owner = owner
      channel.members.add(owner)
    }

    if (props) {
      try {
        channel.setProps(hardSanitiseProps({ props }))
      } catch (err) {
        if (!(err instanceof PropSizeError)) {
          captureException(err)
        }
        return buildErrorResponse({ props: [(err as Error).message] })
      }
    }

    if (!req.ctx.state.user.api) {
      createGameActivity(em, {
        user: req.ctx.state.user,
        game: req.ctx.state.game,
        type: GameActivityType.GAME_CHANNEL_CREATED,
        extra: {
          channelName: channel.name
        }
      })
    }

    await em.persistAndFlush(channel)
    await deferClearResponseCache(GameChannel.getSearchCacheKey(channel.game, true))

    await channel.sendMessageToMembers(req.ctx.wss, 'v1.channels.player-joined', {
      channel,
      playerAlias: req.ctx.state.alias
    })

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(req.ctx.state.includeDevData)
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id'
  })
  @Validate({ body: [GameChannel] })
  @HasPermission(GameChannelPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const { name, props, ownerAliasId, autoCleanup, private: isPrivate, temporaryMembership } = req.body
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    const changedProperties = []

    if (typeof name === 'string' && name.trim().length > 0) {
      channel.name = name
      changedProperties.push('name')
    }

    if (props) {
      try {
        channel.setProps(mergeAndSanitiseProps({ prevProps: channel.props.getItems(), newProps: props }))
      } catch (err) {
        if (err instanceof PropSizeError) {
          return buildErrorResponse({ props: [err.message] })
        /* v8 ignore start */
        }
        throw err
        /* v8 ignore stop */
      }
      changedProperties.push('props')
    }

    if (typeof ownerAliasId !== 'undefined') {
      if (ownerAliasId !== null) {
        const newOwner = await em.getRepository(PlayerAlias).findOne({
          id: ownerAliasId,
          player: {
            game: req.ctx.state.game
          }
        })

        if (!newOwner) {
          req.ctx.throw(404, 'New owner not found')
        }

        if (!channel.hasMember(newOwner.id)) {
          channel.members.add(newOwner)
        }

        channel.owner = newOwner

        await channel.sendMessageToMembers(req.ctx.wss, 'v1.channels.ownership-transferred', {
          channel,
          newOwner
        })
      } else {
        channel.owner = null
      }

      changedProperties.push('ownerAliasId')
    }

    if (typeof autoCleanup === 'boolean') {
      channel.autoCleanup = autoCleanup
      changedProperties.push('autoCleanup')
    }

    if (typeof isPrivate === 'boolean') {
      channel.private = isPrivate
      changedProperties.push('private')
    }

    if (typeof temporaryMembership === 'boolean') {
      channel.temporaryMembership = temporaryMembership
      changedProperties.push('temporaryMembership')
    }

    if (changedProperties.length > 0) {
      await deferClearResponseCache(GameChannel.getSearchCacheKey(channel.game, true))

      // don't send this message if the only thing that changed is the owner
      // that is covered by the ownership transferred message
      if (!(changedProperties.length === 1 && changedProperties[0] === 'ownerAliasId')) {
        await channel.sendMessageToMembers(req.ctx.wss, 'v1.channels.updated', {
          channel,
          changedProperties
        })
      }
    }

    if (!req.ctx.state.user.api) {
      createGameActivity(em, {
        user: req.ctx.state.user,
        game: req.ctx.state.game,
        type: GameActivityType.GAME_CHANNEL_UPDATED,
        extra: {
          channelName: req.ctx.state.channel.name,
          display: {
            'Updated properties': changedProperties.map((key) => {
              const property = typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]
              return `${key}: ${property}`
            }).join(', ')
          }
        }
      })
    }

    await em.flush()

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(req.ctx.state.includeDevData)
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id'
  })
  @HasPermission(GameChannelPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    await channel.sendDeletedMessage(req.ctx.wss)

    if (!req.ctx.state.user.api) {
      createGameActivity(em, {
        user: req.ctx.state.user,
        game: req.ctx.state.game,
        type: GameActivityType.GAME_CHANNEL_DELETED,
        extra: {
          channelName: req.ctx.state.channel.name
        }
      })
    }

    await em.removeAndFlush(channel)

    return {
      status: 204
    }
  }
}
