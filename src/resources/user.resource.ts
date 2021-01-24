import { EntityResource } from 'koa-rest-services'
import Game from '../entities/game'
import User from '../entities/user'
import GameResource from './game.resource'

export default class UserResource extends EntityResource<User> {
  id: number
  lastSeenAt: Date
  emailConfirmed: boolean
  games: GameResource[]

  constructor(entity: User) {
    super(entity)
    this.id = entity.id
    this.lastSeenAt = entity.lastSeenAt
    this.emailConfirmed = entity.emailConfirmed
    this.games = entity.games.toArray().map((game: Game) => new GameResource(game))
  }
}
