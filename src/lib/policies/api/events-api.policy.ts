import Policy from '../policy'
import { ServiceRequest } from 'koa-rest-services'
import PlayerAlias from '../../../entities/player-alias'
import APIKey from '../../../entities/api-key'

export default class EventsAPIPolicy extends Policy {
  async get(req: ServiceRequest): Promise<boolean> {
    return await this.hasScope('read:events')
  }

  async post(req: ServiceRequest): Promise<boolean> {
    const { aliasId } = req.body

    const alias = await this.em.getRepository(PlayerAlias).findOne(aliasId, ['player.game'])
    if (!alias) this.ctx.throw(404, 'Player alias not found')

    const key: APIKey = await this.getAPIKey()
    if (alias.player.game.id !== key.game.id) return false

    this.ctx.state.game = key.game.id

    return await this.hasScope('write:events')
  }
}
