import { EntityResource } from 'koa-rest-services'
import Player from '../entities/player'
import PlayerAliasResource from './player-alias.resource'
import PropsResource from './props.resource'

export default class PlayerResource extends EntityResource<Player> {
  async transform(): Promise<any> {
    const items = await this.entity.aliases.loadItems()
    const aliases = await Promise.all(items.map(async (alias) => {
      const resource = new PlayerAliasResource(alias)
      return await resource.transform()
    }))

    const props = await new PropsResource(this.entity.props).transform()

    return {
      id: this.entity.id,
      props,
      aliases,
      createdAt: this.entity.createdAt,
      lastSeenAt: this.entity.lastSeenAt
    }
  }
}
