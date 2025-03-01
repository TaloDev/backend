import { forwardRequest, ForwardTo, HasPermission, Request, Response, Routes, Validate } from 'koa-clay'
import GameChannelAPIPolicy from '../../policies/api/game-channel-api.policy'
import APIService from './api-service'
import GameChannel from '../../entities/game-channel'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelAPIDocs from '../../docs/game-channel-api.docs'
import PlayerAlias from '../../entities/player-alias'

function canModifyChannel(channel: GameChannel, alias: PlayerAlias): boolean {
  return channel.owner ? channel.owner.id === alias.id : false
}

@Routes([
  {
    method: 'GET',
    handler: 'index',
    docs: GameChannelAPIDocs.index
  },
  {
    method: 'GET',
    path: '/subscriptions',
    handler: 'subscriptions',
    docs: GameChannelAPIDocs.subscriptions
  },
  {
    method: 'GET',
    path: '/:id',
    handler: 'get',
    docs: GameChannelAPIDocs.get
  },
  {
    method: 'POST',
    handler: 'post',
    docs: GameChannelAPIDocs.post
  },
  {
    method: 'POST',
    path: '/:id/join',
    handler: 'join',
    docs: GameChannelAPIDocs.join
  },
  {
    method: 'POST',
    path: '/:id/leave',
    handler: 'leave',
    docs: GameChannelAPIDocs.leave
  },
  {
    method: 'PUT',
    path: '/:id',
    handler: 'put',
    docs: GameChannelAPIDocs.put
  },
  {
    method: 'DELETE',
    path: '/:id',
    handler: 'delete',
    docs: GameChannelAPIDocs.delete
  }
])
export default class GameChannelAPIService extends APIService {
  @Validate({ query: ['page'] })
  @HasPermission(GameChannelAPIPolicy, 'index')
  @ForwardTo('games.game-channels', 'index')
  async index(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'subscriptions')
  async subscriptions(req: Request): Promise<Response> {
    const channels = await req.ctx.state.alias.channels.loadItems()

    return {
      status: 200,
      body: {
        channels: await Promise.all(channels.map((channel) => channel.toJSONWithCount(req.ctx.em, req.ctx.state.includeDevData)))
      }
    }
  }

  @HasPermission(GameChannelAPIPolicy, 'get')
  async get(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Validate({
    headers: ['x-talo-alias'],
    body: [GameChannel]
  })
  @HasPermission(GameChannelAPIPolicy, 'post')
  @ForwardTo('games.game-channels', 'post')
  async post(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'join')
  async join(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (!channel.members.getIdentifiers().includes(req.ctx.state.alias.id)) {
      channel.members.add(req.ctx.state.alias)
      await channel.sendMessageToMembers(req, 'v1.channels.player-joined', {
        channel,
        playerAlias: req.ctx.state.alias
      })

      await em.flush()
    }

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'leave')
  async leave(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (channel.autoCleanup && (channel.owner?.id === req.ctx.state.alias.id || channel.members.count() === 1)) {
      await em.removeAndFlush(channel)

      return {
        status: 204
      }
    }

    if (channel.members.getIdentifiers().includes(req.ctx.state.alias.id)) {
      if (channel.owner?.id === req.ctx.state.alias.id) {
        channel.owner = null
      }

      await channel.sendMessageToMembers(req, 'v1.channels.player-left', {
        channel,
        playerAlias: req.ctx.state.alias
      })
      channel.members.remove(req.ctx.state.alias)

      await em.flush()
    }

    return {
      status: 204
    }
  }

  @Validate({
    headers: ['x-talo-alias'],
    body: [GameChannel]
  })
  @HasPermission(GameChannelAPIPolicy, 'put')
  @ForwardTo('games.game-channels', 'put')
  async put(req: Request): Promise<Response> {
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    return forwardRequest(req)
  }

  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'delete')
  @ForwardTo('games.game-channels', 'delete')
  async delete(req: Request): Promise<Response> {
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    return forwardRequest(req)
  }
}
