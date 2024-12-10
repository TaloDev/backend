import { forwardRequest, ForwardTo, HasPermission, Request, Response, Routes, Validate } from 'koa-clay'
import GameChannelAPIPolicy from '../../policies/api/game-channel-api.policy'
import APIService from './api-service'
import GameChannel from '../../entities/game-channel'
import { EntityManager } from '@mikro-orm/mysql'
import sanitiseProps from '../../lib/props/sanitiseProps'
import Socket from '../../socket'
import { sendMessage, sendMessages, SocketMessageResponse } from '../../socket/messages/socketMessage'
import GameChannelAPIDocs from '../../docs/game-channel-api.docs'
import PlayerAlias from '../../entities/player-alias'

function sendMessageToChannelMembers<T>(req: Request, channel: GameChannel, res: SocketMessageResponse, data: T) {
  const socket: Socket = req.ctx.wss
  const conns = socket.findConnections((conn) => channel.members.getIdentifiers().includes(conn.playerAlias.id))
  sendMessages(conns, res, data)
}

function canModifyChannel(channel: GameChannel, alias: PlayerAlias): boolean {
  return channel.owner ? channel.owner.id === alias.id : true
}

@Routes([
  {
    method: 'GET',
    handler: 'index',
    docs: GameChannelAPIDocs.index
  },
  {
    method: 'GET',
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
    const { name, props } = req.body
    const em: EntityManager = req.ctx.em

    const channel = new GameChannel(req.ctx.state.game)
    channel.name = name
    channel.owner = req.ctx.state.alias
    channel.members.add(req.ctx.state.alias)

    if (props) {
      channel.props = sanitiseProps(props)
    }

    await em.persistAndFlush(channel)

    const socket: Socket = req.ctx.wss
    const conn = socket.findConnections((conn) => conn.playerAlias.id === req.ctx.state.alias.id)[0]
    if (conn) {
      sendMessage(conn, 'v1.channels.player-joined', { channel })
    }

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Validate({
    headers: ['x-talo-alias'],
    body: ['name']
  })
  @HasPermission(GameChannelAPIPolicy, 'join')
  async join(req: Request): Promise<Response> {
    const { name } = req.body
    const em: EntityManager = req.ctx.em

    const channel = await em.getRepository(GameChannel).findOne({ game: req.ctx.state.game, name })
    if (!channel) {
      return {
        status: 404,
        body: {
          error: 'Channel not found'
        }
      }
    }

    if (!(await channel.members.load()).getIdentifiers().includes(req.ctx.state.alias.id)) {
      channel.members.add(req.ctx.state.alias)
      await em.flush()
    }

    sendMessageToChannelMembers(req, channel, 'v1.channels.player-joined', { channel })

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Validate({
    headers: ['x-talo-alias'],
    body: ['name']
  })
  @HasPermission(GameChannelAPIPolicy, 'leave')
  async leave(req: Request): Promise<Response> {
    const { id } = req.params
    const em: EntityManager = req.ctx.em

    const channel = await em.getRepository(GameChannel).findOne(Number(id))
    if (!channel) {
      return {
        status: 404,
        body: {
          error: 'Channel not found'
        }
      }
    }

    if (channel.autoCleanup && channel.owner.id === req.ctx.state.alias.id) {
      await channel.members.removeAll()
      await em.removeAndFlush(channel)

      return {
        status: 204
      }
    }

    (await channel.members.load()).remove(req.ctx.state.alias)
    await em.flush()

    sendMessageToChannelMembers(req, channel, 'v1.channels.player-left', { channel })

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
    const { id } = req.params
    const { name, props, ownerAliasId } = req.body
    const em: EntityManager = req.ctx.em

    const channel = await em.getRepository(GameChannel).findOne(Number(id))
    if (!channel) {
      return {
        status: 404,
        body: {
          error: 'Channel not found'
        }
      }
    }

    if (canModifyChannel(channel, req.ctx.state.alias)) {
      return {
        status: 403,
        body: {
          error: 'This player is not the owner of the channel'
        }
      }
    }

    if (name) {
      channel.name = name
    }

    if (props) {
      channel.props = sanitiseProps(props)
    }

    if (ownerAliasId) {
      const newOwner = await em.getRepository(PlayerAlias).findOne({
        id: ownerAliasId,
        player: {
          game: req.ctx.state.game
        }
      })

      if (!newOwner) {
        return {
          status: 404,
          body: {
            error: 'Owner alias not found'
          }
        }
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
    const { id } = req.params
    const em: EntityManager = req.ctx.em

    const channel = await em.getRepository(GameChannel).findOne(Number(id))
    if (!channel) {
      return {
        status: 404,
        body: {
          error: 'Channel not found'
        }
      }
    }

    if (canModifyChannel(channel, req.ctx.state.alias)) {
      return {
        status: 403,
        body: {
          error: 'This player is not the owner of the channel'
        }
      }
    }

    await channel.members.removeAll()
    await em.removeAndFlush(channel)

    return {
      status: 204
    }
  }
}
