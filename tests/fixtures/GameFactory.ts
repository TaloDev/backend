import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import casual from 'casual'
import User from '../../src/entities/user'

export default class GameFactory extends Factory<Game> {
  private availableUsers: User[]

  constructor(availableUsers: User[]) {
    super(Game, 'base')
    this.register('base', this.base)
    this.register('team', this.team)

    this.availableUsers = availableUsers
  }

  protected base(): Partial<Game> {
    return {
      name: casual.title
    }
  }

  protected team(game: Game): Partial<Game> {
    const count = casual.integer(0, 2)
    const users: User[] = [...new Array(count)].map(() => casual.random_element(this.availableUsers))
    game.teamMembers.add(...users)
    game.teamMembers.add(this.availableUsers.find((user) => user.password))

    return {}
  }
}
