import { EntityManager, QueryOrder } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import GameChannel from '../entities/game-channel'
import GameChannelPolicy from '../policies/game-channel.policy'
import { GameActivityType } from '../entities/game-activity'
import createGameActivity from '../lib/logging/createGameActivity'
import sanitiseProps from '../lib/props/sanitiseProps'
import { uniqWith } from 'lodash'
import PlayerAlias from '../entities/player-alias'

const itemsPerPage = 50

export default class GameChannelService extends Service {
  @Validate({ query: ['page'] })
  @HasPermission(GameChannelPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { search, page } = req.query
    const em: EntityManager = req.ctx.em

    const query = em.qb(GameChannel, 'gc')
      .select('gc.*')
      .orderBy({ totalMessages: QueryOrder.DESC })
      .limit(itemsPerPage)
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

    const [channels, count] = await query
      .andWhere({
        game: req.ctx.state.game
      })
      .getResultAndCount()

    await em.populate(channels, ['owner'])

    return {
      status: 200,
      body: {
        channels: await Promise.all(channels.map((channel) => channel.toJSONWithCount(em, req.ctx.state.includeDevData))),
        count,
        itemsPerPage,
        isLastPage: (Number(page) * itemsPerPage) + itemsPerPage >= count
      }
    }
  }

  @Validate({ body: [GameChannel] })
  @HasPermission(GameChannelPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, props, autoCleanup, ownerAliasId } = req.body
    const em: EntityManager = req.ctx.em

    const channel = new GameChannel(req.ctx.state.game)
    channel.name = name
    channel.autoCleanup = autoCleanup ?? false

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
      channel.props = sanitiseProps(props)
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

    await channel.sendMessageToMembers(req, 'v1.channels.player-joined', {
      channel,
      playerAlias: req.ctx.state.alias
    })

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Validate({ body: [GameChannel] })
  @HasPermission(GameChannelPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const { name, props, ownerAliasId } = req.body
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    const changedProperties = []

    if (name) {
      channel.name = name
      changedProperties.push('name')
    }

    if (props) {
      const mergedProps = uniqWith([
        ...sanitiseProps(props),
        ...channel.props
      ], (a, b) => a.key === b.key)

      channel.props = sanitiseProps(mergedProps, true)

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

        if (!channel.members.getIdentifiers().includes(newOwner.id)) {
          channel.members.add(newOwner)
        }

        channel.owner = newOwner

        await channel.sendMessageToMembers(req, 'v1.channels.ownership-transferred', {
          channel,
          newOwner
        })
      } else {
        channel.owner = null
      }

      changedProperties.push('ownerAliasId')
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
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @HasPermission(GameChannelPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    await channel.sendMessageToMembers(req, 'v1.channels.deleted', {
      channel
    })

    await channel.members.removeAll()

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
