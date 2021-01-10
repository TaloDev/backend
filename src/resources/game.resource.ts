import { EntityResource } from 'koa-rest-services'
import Game from '../entities/game'

export default class GameResource extends EntityResource<Game> {
  id: number
  name: string
  props?: { [key: string]: any }
  createdAt: Date
  updatedAt: Date

  constructor(entity: Game) {
    super(entity)
    this.id = entity.id
    this.name = entity.name
    this.props = entity.props
    this.createdAt = entity.createdAt
    this.updatedAt = entity.updatedAt
  }
}
