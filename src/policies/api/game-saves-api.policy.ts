import Policy from '../policy'
import { ServicePolicyDenial, ServicePolicyResponse, ServiceRequest } from 'koa-rest-services'
import PlayerAlias from '../../entities/player-alias'
import GameSave from '../../entities/game-save'
import Player from '../../entities/player'

export default class GameSavesAPIPolicy extends Policy {
  async getPlayer(aliasId: number): Promise<Player> {
    const key = await this.getAPIKey()

    const playerAlias = await this.em.getRepository(PlayerAlias).findOne({
      id: Number(aliasId),
      player: {
        game: key.game
      }
    }, ['player'])

    return playerAlias?.player
  }

  async index(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { aliasId } = req.query

    const player = await this.getPlayer(Number(aliasId))
    if (!player) return new ServicePolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.player = player

    return await this.hasScope('read:gameSaves')
  }

  async post(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { aliasId } = req.body

    const player = await this.getPlayer(aliasId)
    if (!player) return new ServicePolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.player = player

    return await this.hasScope('write:gameSaves')
  }

  async patch(req: ServiceRequest): Promise<ServicePolicyResponse> {
    const { id } = req.params
    const { aliasId } = req.body

    const key = await this.getAPIKey()

    const save = await this.em.getRepository(GameSave).findOne({
      id: Number(id),
      player: {
        aliases: {
          id: aliasId
        },
        game: key.game
      }
    }, ['player'])

    if (!save) return new ServicePolicyDenial({ message: 'Save not found' }, 404)

    this.ctx.state.save = save

    return await this.hasScope('write:gameSaves')
  }
}
