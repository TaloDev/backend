import { forwardRequest, ForwardTo, HasPermission, Request, Response, Routes, Validate } from 'koa-clay'
import GameChannelAPIPolicy from '../../policies/api/game-channel-api.policy'
import APIService from './api-service'
import GameChannel from '../../entities/game-channel'
import { EntityManager } from '@mikro-orm/mysql'
import sanitiseProps from '../../lib/props/sanitiseProps'
import Socket from '../../socket'
import { sendMessages, SocketMessageResponse } from '../../socket/messages/socketMessage'
import GameChannelAPIDocs from '../../docs/game-channel-api.docs'
import PlayerAlias from '../../entities/player-alias'
import { uniqWith } from 'lodash'
import { APIKeyScope } from '../../entities/api-key'

function sendMessageToChannelMembers<T>(req: Request, channel: GameChannel, res: SocketMessageResponse, data: T) {
  const socket: Socket = req.ctx.wss
  const conns = socket.findConnections((conn) => {
    return conn.hasScope(APIKeyScope.READ_GAME_CHANNELS) &&
      channel.members.getIdentifiers().includes(conn.playerAliasId)
  })
  sendMessages(conns, res, data)
}

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

  @Validate({
    headers: ['x-talo-alias'],
    body: [GameChannel]
  })
  @HasPermission(GameChannelAPIPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, props, autoCleanup } = req.body
    const em: EntityManager = req.ctx.em

    const channel = new GameChannel(req.ctx.state.game)
    channel.name = name
    channel.owner = req.ctx.state.alias
    channel.members.add(req.ctx.state.alias)
    channel.autoCleanup = autoCleanup ?? false

    if (props) {
      channel.props = sanitiseProps(props)
    }

    await em.persistAndFlush(channel)

    sendMessageToChannelMembers(req, channel, 'v1.channels.player-joined', {
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

  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'join')
  async join(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (!(await channel.members.load()).getIdentifiers().includes(req.ctx.state.alias.id)) {
      sendMessageToChannelMembers(req, channel, 'v1.channels.player-joined', {
        channel,
        playerAlias: req.ctx.state.alias
      })

      channel.members.add(req.ctx.state.alias)
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

    if (channel.autoCleanup && (channel.owner.id === req.ctx.state.alias.id || await channel.members.loadCount() === 1)) {
      await em.removeAndFlush(channel)

      return {
        status: 204
      }
    }

    if ((await channel.members.load()).getIdentifiers().includes(req.ctx.state.alias.id)) {
      if (channel.owner.id === req.ctx.state.alias.id) {
        channel.owner = null
      }

      channel.members.remove(req.ctx.state.alias)
      sendMessageToChannelMembers(req, channel, 'v1.channels.player-left', {
        channel,
        playerAlias: req.ctx.state.alias
      })

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
  async put(req: Request): Promise<Response> {
    const { name, props, ownerAliasId } = req.body
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    if (name) {
      channel.name = name
    }

    if (props) {
      const mergedProps = uniqWith([
        ...sanitiseProps(props),
        ...channel.props
      ], (a, b) => a.key === b.key)

      channel.props = sanitiseProps(mergedProps, true)
    }

    if (ownerAliasId) {
      const newOwner = await em.getRepository(PlayerAlias).findOne({
        id: ownerAliasId,
        player: {
          game: req.ctx.state.game
        }
      })

      if (!newOwner) {
        req.ctx.throw(404, 'New owner not found')
      }

      channel.owner = newOwner
    }

    await em.flush()

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
  @HasPermission(GameChannelAPIPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    await channel.members.removeAll()
    await em.removeAndFlush(channel)

    return {
      status: 204
    }
  }
}
