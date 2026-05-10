import { rand, randWord } from '@ngneat/falso'
import { Factory } from 'hefty'
import GameActivity, { GameActivityType } from '../../src/entities/game-activity.js'
import Game from '../../src/entities/game.js'
import User from '../../src/entities/user.js'

export default class GameActivityFactory extends Factory<GameActivity> {
  private availableGames: Game[]
  private availableUsers: User[]

  constructor(availableGames: Game[], availableUsers: User[]) {
    super(GameActivity)

    this.availableGames = availableGames
    this.availableUsers = availableUsers
  }

  protected override definition() {
    const type: GameActivityType = rand([GameActivityType.LEADERBOARD_DELETED])
    const extra: { [key: string]: unknown } = {}

    switch (type) {
      case GameActivityType.LEADERBOARD_DELETED:
        extra.leaderboard = randWord()
        break
    }

    this.state(() => ({
      game: this.availableGames.length > 0 ? rand(this.availableGames) : undefined,
      user: rand(this.availableUsers),
      type,
      extra,
    }))
  }
}
