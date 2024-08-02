import { Factory } from 'hefty'
import casual from 'casual'
import GameActivity, { GameActivityType } from '../../src/entities/game-activity'
import Game from '../../src/entities/game'
import User from '../../src/entities/user'

export default class GameActivityFactory extends Factory<GameActivity> {
  private availableGames: Game[]
  private availableUsers: User[]

  constructor(availableGames: Game[], availableUsers: User[]) {
    super(GameActivity)

    this.availableGames = availableGames
    this.availableUsers = availableUsers
  }

  protected definition(): void {
    const type: GameActivityType = casual.random_element([GameActivityType.LEADERBOARD_DELETED])
    const extra: { [key: string]: unknown } = {}

    switch (type) {
      case GameActivityType.LEADERBOARD_DELETED:
        extra.leaderboard = casual.word
        break
    }

    this.state(() => ({
      game: this.availableGames.length > 0 ? casual.random_element(this.availableGames) : null,
      user: casual.random_element(this.availableUsers),
      type,
      extra
    }))
  }
}
