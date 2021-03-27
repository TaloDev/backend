import { EntityResource } from 'koa-rest-services'
import Game from '../entities/game'
import User from '../entities/user'
import GameResource from './game.resource'

export default class UserResource extends EntityResource<User> {
  async transform(): Promise<any> {
    const items = await this.entity.games.loadItems()
    const games = await Promise.all(items.map(async (game) => {
      const resource = new GameResource(game)
      return await resource.transform()
    }))

    return {
      id: this.entity.id,
      email: this.entity.email,
      lastSeenAt: this.entity.lastSeenAt,
      emailConfirmed: this.entity.emailConfirmed,
      games
    }
  }
}
