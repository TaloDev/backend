import { EntityResource } from 'koa-rest-services'
import Event from '../entities/event'

export default class EventResource extends EntityResource<Event> {
  async transform(): Promise<any> {
    return {
      id: this.entity.id,
      name: this.entity.name,
      props: this.entity.props,
      playerId: this.entity.player.id,
      createdAt: this.entity.createdAt
    }
  }
}
