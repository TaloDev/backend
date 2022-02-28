import Policy from '../policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import PlayerAlias from '../../entities/player-alias'
import GameSave from '../../entities/game-save'
import Player from '../../entities/player'

export default class GameSaveAPIPolicy extends Policy {
  async getPlayer(aliasId: number): Promise<Player> {
    const key = await this.getAPIKey()

    const playerAlias = await this.em.getRepository(PlayerAlias).findOne({
      id: Number(aliasId),
      player: {
        game: key.game
      }
    }, {
      populate: ['player']
    })

    return playerAlias?.player
  }

  async index(req: Request): Promise<PolicyResponse> {
    const { aliasId } = req.query

    const player = await this.getPlayer(Number(aliasId))
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.player = player

    return await this.hasScope('read:gameSaves')
  }

  async post(req: Request): Promise<PolicyResponse> {
    const { aliasId } = req.body

    const player = await this.getPlayer(aliasId)
    if (!player) return new PolicyDenial({ message: 'Player not found' }, 404)

    this.ctx.state.player = player

    return await this.hasScope('write:gameSaves')
  }

  async patch(req: Request): Promise<PolicyResponse> {
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
    }, {
      populate: ['player']
    })

    if (!save) return new PolicyDenial({ message: 'Save not found' }, 404)

    this.ctx.state.save = save

    return await this.hasScope('write:gameSaves')
  }
}
