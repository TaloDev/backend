import { EntityResource } from 'koa-rest-services'
import Game from '../entities/game'

export default class GameResource extends EntityResource<Game> {
  async transform(): Promise<any> {
    return {
      id: this.entity.id,
      name: this.entity.name,
      props: this.entity.props,
      createdAt: this.entity.createdAt
    }
  }
}
