import { EntityResource } from 'koa-rest-services'
import Player from '../entities/player'

export default class PlayerResource extends EntityResource<Player> {
  async transform(): Promise<any> {
    // pretty much just to not break the frontend with the new aliases entity
    const items = await this.entity.aliases.loadItems()
    const aliases = items.reduce((acc, curr) => ({
      ...acc,
      [curr.service]: curr.identifier
    }), {})

    return {
      id: this.entity.id,
      props: this.entity.props,
      aliases,
      gameId: this.entity.game.id,
      createdAt: this.entity.createdAt,
      lastSeenAt: this.entity.lastSeenAt
    }
  }
}
