import { EntityResource } from 'koa-rest-services'
import Event from '../entities/event'
import PlayerAliasResource from './player-alias.resource'
import PropsResource from './props.resource'

export default class EventResource extends EntityResource<Event> {
  async transform(): Promise<any> {
    return {
      id: this.entity.id,
      name: this.entity.name,
      props: await new PropsResource(this.entity.props).transform(),
      playerAlias: await new PlayerAliasResource(this.entity.playerAlias).transform(),
      gameId: this.entity.game.id,
      createdAt: this.entity.createdAt
    }
  }
}
