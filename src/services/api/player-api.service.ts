import { EntityManager } from '@mikro-orm/core'
import { Request, Response, Routes, Validate, HasPermission, ForwardTo, forwardRequest } from 'koa-clay'
import APIKey, { APIKeyScope } from '../../entities/api-key'
import Player from '../../entities/player'
import GameSave from '../../entities/game-save'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import PlayerAPIPolicy from '../../policies/api/player-api.policy'
import APIService from './api-service'
import uniqWith from 'lodash.uniqwith'
import PlayerAPIDocs from '../../docs/player-api.docs'
import PlayerProp from '../../entities/player-prop'
import PlayerGameStat from '../../entities/player-game-stat'
import checkScope from '../../policies/checkScope'

@Routes([
  {
    method: 'GET',
    path: '/identify',
    handler: 'identify',
    docs: PlayerAPIDocs.identify
  },
  {
    method: 'PATCH',
    docs: PlayerAPIDocs.patch
  },
  {
    method: 'POST',
    path: '/merge',
    handler: 'merge',
    docs: PlayerAPIDocs.merge
  }
])
export default class PlayerAPIService extends APIService {
  @Validate({
    query: ['service', 'identifier']
  })
  @HasPermission(PlayerAPIPolicy, 'identify')
  @ForwardTo('games.players', 'post')
  async identify(req: Request): Promise<Response> {
    const { service, identifier } = req.query
    const em: EntityManager = req.ctx.em

    const key: APIKey = await this.getAPIKey(req.ctx)

    const alias = await em.getRepository(PlayerAlias).findOne({
      service: service as PlayerAliasService,
      identifier,
      player: {
        game: key.game
      }
    })

    if (!alias) {
      if (checkScope(key, APIKeyScope.WRITE_PLAYERS)) {
        req.ctx.state.game = key.game

        const res = await forwardRequest(req, {
          body: {
            aliases: [
              {
                service,
                identifier
              }
            ]
          }
        })

        return {
          status: res.status,
          body: {
            alias: res.body.player?.aliases[0]
          }
        }
      } else {
        req.ctx.throw(404, 'Player not found. Use an access key with the write:players scope to automatically create players')
      }
    }

    alias.player.lastSeenAt = new Date()
    await em.flush()

    return {
      status: 200,
      body: {
        alias
      }
    }
  }

  @HasPermission(PlayerAPIPolicy, 'patch')
  @ForwardTo('games.players', 'patch')
  async patch(req: Request): Promise<Response> {
    return await forwardRequest(req)
  }

  @Validate({
    body: ['playerId1', 'playerId2']
  })
  @HasPermission(PlayerAPIPolicy, 'merge')
  async merge(req: Request): Promise<Response> {
    const { playerId1, playerId2 } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const player1 = await em.getRepository(Player).findOne({
      id: playerId1,
      game: key.game
    })

    if (!player1) req.ctx.throw(404, `Player ${playerId1} does not exist`)

    const player2 = await em.getRepository(Player).findOne({
      id: playerId2,
      game: key.game
    }, {
      populate: ['aliases']
    })

    if (!player2) req.ctx.throw(404, `Player ${playerId2} does not exist`)

    const mergedProps: PlayerProp[] = uniqWith([
      ...player2.props.getItems(),
      ...player1.props.getItems()
    ], (a, b) => a.key === b.key)

    player1.setProps(mergedProps)
    player2.aliases.getItems().forEach((alias) => alias.player = player1)

    const saves = await em.getRepository(GameSave).find({ player: player2 })
    saves.forEach((save) => save.player = player1)

    const stats = await em.getRepository(PlayerGameStat).find({ player: player2 })
    stats.forEach((stat) => stat.player = player1)

    await em.removeAndFlush(player2)

    return {
      status: 200,
      body: {
        player: player1
      }
    }
  }
}
