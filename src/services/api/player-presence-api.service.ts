import { EntityManager } from '@mikro-orm/mysql'
import APIService from './api-service'
import { HasPermission, Request, Response, Route, Validate } from 'koa-clay'
import PlayerPresenceAPIPolicy from '../../policies/api/player-presence-api.policy'
import Player from '../../entities/player'
import PlayerPresence from '../../entities/player-presence'
import PlayerAlias from '../../entities/player-alias'
import PlayerPresenceAPIDocs from '../../docs/player-presence-api.docs'
import { TraceService } from '../../lib/routing/trace-service'

@TraceService()
export default class PlayerPresenceAPIService extends APIService {
  @Route({
    method: 'GET',
    path: '/:id',
    docs: PlayerPresenceAPIDocs.get
  })
  @HasPermission(PlayerPresenceAPIPolicy, 'get')
  async get(req: Request): Promise<Response> {
    const { id } = req.params
    const em: EntityManager = req.ctx.em

    const player = await em.getRepository(Player).findOne({
      id,
      game: req.ctx.state.game
    })

    if (!player) {
      req.ctx.throw(404, 'Player not found')
    }

    const presence = player.presence ?? new PlayerPresence(player)

    return {
      status: 200,
      body: {
        presence
      }
    }
  }

  @Route({
    method: 'PUT',
    docs: PlayerPresenceAPIDocs.put
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(PlayerPresenceAPIPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const { online, customStatus } = req.body
    const em: EntityManager = req.ctx.em

    const playerAlias = await em.getRepository(PlayerAlias).findOne({
      id: req.ctx.state.currentAliasId,
      player: {
        game: req.ctx.state.game
      }
    })

    if (!playerAlias) {
      req.ctx.throw(404, 'Player not found')
    }

    const player = playerAlias.player
    await playerAlias.player.setPresence(em, req.ctx.wss, playerAlias, online, customStatus)

    return {
      status: 200,
      body: {
        presence: player.presence
      }
    }
  }
}
