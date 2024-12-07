import { forwardRequest, ForwardTo, HasPermission, Request, Response, Validate } from 'koa-clay'
import GameChannelAPIPolicy from '../../policies/api/game-channel-api.policy'
import APIService from './api-service'
import GameChannel from '../../entities/game-channel'
import { EntityManager } from '@mikro-orm/mysql'
import PlayerAlias from '../../entities/player-alias'
import sanitiseProps from '../../lib/props/sanitiseProps'
import Socket from '../../socket'
import { sendMessage, sendMessages, SocketMessageResponse } from '../../socket/messages/socketMessage'

async function getAlias(req: Request): Promise<PlayerAlias | null> {
  const em: EntityManager = req.ctx.em
  return await em.getRepository(PlayerAlias).findOne({
    id: req.ctx.state.currentAliasId,
    player: {
      game: req.ctx.state.game
    }
  })
}

async function sendMessageToChannelMembers<T>(req: Request, channel: GameChannel, res: SocketMessageResponse, data: T) {
  const socket: Socket = req.ctx.wss
  const conns = socket.findConnections((conn) => channel.members.getIdentifiers().includes(conn.playerAlias.id))
  sendMessages(conns, res, data)
}

export default class GameChannelAPIService extends APIService {
  @ForwardTo('games.game-channels', 'index')
  async index(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Validate({
    headers: ['x-talo-alias'],
    body: [GameChannel]
  })
  @HasPermission(GameChannelAPIPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, props } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await getAlias(req)
    if (!alias) {
      return {
        status: 404,
        body: {
          error: 'Player not found'
        }
      }
    }

    const channel = new GameChannel(req.ctx.state.game)
    channel.name = name
    channel.owner = alias
    channel.members.add(alias)

    if (props) {
      channel.props = sanitiseProps(props)
    }

    await em.persistAndFlush(channel)

    const socket: Socket = req.ctx.wss
    const conn = socket.findConnections((conn) => conn.playerAlias.id === alias.id)[0]
    if (conn) {
      sendMessage(conn, 'v1.channels.player-joined', { channel })
    }

    return {
      status: 200,
      body: {
        channel
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

    const alias = await getAlias(req)
    if (!alias) {
      return {
        status: 404,
        body: {
          error: 'Player not found'
        }
      }
    }

    const channel = await em.getRepository(GameChannel).findOne({ game: req.ctx.state.game, name })
    if (!channel) {
      return {
        status: 404,
        body: {
          error: 'Channel not found'
        }
      }
    }

    await channel.members.loadItems()
    channel.members.add(alias)
    await em.flush()

    sendMessageToChannelMembers(req, channel, 'v1.channels.player-left', { channel })

    return {
      status: 200,
      body: {
        channel
      }
    }
  }

  @Validate({
    headers: ['x-talo-alias'],
    body: ['name']
  })
  @HasPermission(GameChannelAPIPolicy, 'leave')
  async leave(req: Request): Promise<Response> {
    const { name } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await getAlias(req)
    if (!alias) {
      return {
        status: 404,
        body: {
          error: 'Player not found'
        }
      }
    }

    const channel = await em.getRepository(GameChannel).findOne({ game: req.ctx.state.game, name })
    if (!channel) {
      return {
        status: 404,
        body: {
          error: 'Channel not found'
        }
      }
    }

    await channel.members.loadItems()
    channel.members.remove(alias)
    await em.flush()

    sendMessageToChannelMembers(req, channel, 'v1.channels.player-left', { channel })

    return {
      status: 200,
      body: {
        channel
      }
    }
  }
}
