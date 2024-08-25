import { EntityManager } from '@mikro-orm/mysql'
import { differenceInSeconds } from 'date-fns'
import { HasPermission, Request, Response, Routes, Validate, Docs } from 'koa-clay'
import GameStatAPIDocs from '../../docs/game-stat-api.docs'
import GameStat from '../../entities/game-stat'
import PlayerGameStat from '../../entities/player-game-stat'
import triggerIntegrations from '../../lib/integrations/triggerIntegrations'
import GameStatAPIPolicy from '../../policies/api/game-stat-api.policy'
import APIService from './api-service'

@Routes([
  {
    method: 'PUT',
    path: '/:internalName'
  }
])
export default class GameStatAPIService extends APIService {
  @Validate({
    headers: ['x-talo-player'],
    body: ['change']
  })
  @HasPermission(GameStatAPIPolicy, 'put')
  @Docs(GameStatAPIDocs.put)
  async put(req: Request): Promise<Response> {
    const { change } = req.body
    const em: EntityManager = req.ctx.em

    const stat: GameStat = req.ctx.state.stat

    let playerStat = await em.getRepository(PlayerGameStat).findOne({
      player: req.ctx.state.player,
      stat: req.ctx.state.stat
    })

    if (playerStat && differenceInSeconds(new Date(), playerStat.createdAt) < stat.minTimeBetweenUpdates) {
      req.ctx.throw(400, `Stat cannot be updated more often than every ${stat.minTimeBetweenUpdates} seconds`)
    }

    if (Math.abs(change) > (stat.maxChange ?? Infinity)) {
      req.ctx.throw(400, `Stat change cannot be more than ${stat.maxChange}`)
    }

    const currentValue = playerStat?.value ?? stat.defaultValue

    if (currentValue + change < (stat.minValue ?? -Infinity)) {
      req.ctx.throw(400, `Stat would go below the minValue of ${stat.minValue}`)
    }

    if (currentValue + change > (stat.maxValue ?? Infinity)) {
      req.ctx.throw(400, `Stat would go above the maxValue of ${stat.maxValue}`)
    }

    if (!playerStat) {
      playerStat = new PlayerGameStat(req.ctx.state.player, req.ctx.state.stat)
      if (req.ctx.state.continuityDate) {
        playerStat.createdAt = req.ctx.state.continuityDate
      }

      em.persist(playerStat)
    }

    playerStat.value += change
    if (stat.global) stat.globalValue += change

    await triggerIntegrations(em, stat.game, (integration) => {
      return integration.handleStatUpdated(em, playerStat)
    })

    await em.flush()

    return {
      status: 200,
      body: {
        playerStat
      }
    }
  }
}
