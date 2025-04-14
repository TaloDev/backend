import { forwardRequest, ForwardTo, HasPermission, Request, Response, Route, Validate } from 'koa-clay'
import GameChannelAPIPolicy from '../../policies/api/game-channel-api.policy'
import APIService from './api-service'
import GameChannel from '../../entities/game-channel'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelAPIDocs from '../../docs/game-channel-api.docs'
import PlayerAlias from '../../entities/player-alias'

function canModifyChannel(channel: GameChannel, alias: PlayerAlias): boolean {
  return channel.owner ? channel.owner.id === alias.id : false
}

async function joinChannel(req: Request, channel: GameChannel, playerAlias: PlayerAlias) {
  if (!channel.members.getIdentifiers().includes(playerAlias.id)) {
    channel.members.add(playerAlias)
    await channel.sendMessageToMembers(req, 'v1.channels.player-joined', {
      channel,
      playerAlias
    })

    await (req.ctx.em as EntityManager).flush()
  }
}

export default class GameChannelAPIService extends APIService {
  @Route({
    method: 'GET',
    docs: GameChannelAPIDocs.index
  })
  @Validate({ query: ['page'] })
  @HasPermission(GameChannelAPIPolicy, 'index')
  @ForwardTo('games.game-channels', 'index')
  async index(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Route({
    method: 'GET',
    path: '/subscriptions',
    docs: GameChannelAPIDocs.subscriptions
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'subscriptions')
  async subscriptions(req: Request): Promise<Response> {
    const channels = await (req.ctx.state.alias as PlayerAlias).channels.loadItems()

    return {
      status: 200,
      body: {
        channels: await Promise.all(channels.map((channel) => channel.toJSONWithCount(req.ctx.em, req.ctx.state.includeDevData)))
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:id',
    docs: GameChannelAPIDocs.get
  })
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

  @Route({
    method: 'POST',
    docs: GameChannelAPIDocs.post
  })
  @Validate({
    headers: ['x-talo-alias'],
    body: [GameChannel]
  })
  @HasPermission(GameChannelAPIPolicy, 'post')
  @ForwardTo('games.game-channels', 'post')
  async post(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Route({
    method: 'POST',
    path: '/:id/join',
    docs: GameChannelAPIDocs.join
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'join')
  async join(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (channel.private) {
      req.ctx.throw(403, 'This channel is private')
    }
    await joinChannel(req, channel, req.ctx.state.alias)

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/:id/leave',
    docs: GameChannelAPIDocs.leave
  })
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

  @Route({
    method: 'PUT',
    path: '/:id',
    docs: GameChannelAPIDocs.put
  })
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

  @Route({
    method: 'DELETE',
    path: '/:id',
    docs: GameChannelAPIDocs.delete
  })
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

  @Route({
    method: 'POST',
    path: '/:id/invite',
    docs: GameChannelAPIDocs.invite
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'invite')
  async invite(req: Request<{ inviteeAliasId: number }>): Promise<Response> {
    const { inviteeAliasId } = req.body
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    const inviteeAlias = await em.getRepository(PlayerAlias).findOne({
      id: inviteeAliasId,
      player: {
        game: req.ctx.state.game
      }
    })
    if (!inviteeAlias) {
      req.ctx.throw(404, 'Invitee not found')
    }
    if (inviteeAlias.id === req.ctx.state.alias.id) {
      req.ctx.throw(400, 'Players cannot invite themselves')
    }

    await joinChannel(req, channel, inviteeAlias)

    return {
      status: 204
    }
  }
}
