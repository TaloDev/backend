import { EntityResource } from 'koa-rest-services'
import Organisation from '../entities/organisation'
import GameResource from './game.resource'

export default class OrganisationResource extends EntityResource<Organisation> {
  async transform(): Promise<any> {
    const items = await this.entity.games.loadItems()
    const games = await Promise.all(items.map(async (game) => {
      const resource = new GameResource(game)
      return await resource.transform()
    }))

    return {
      id: this.entity.id,
      name: this.entity.name,
      games
    }
  }
}
