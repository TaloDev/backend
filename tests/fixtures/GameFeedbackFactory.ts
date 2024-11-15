import { Factory } from 'hefty'
import GameFeedback from '../../src/entities/game-feedback'
import GameFeedbackCategoryFactory from './GameFeedbackCategoryFactory'
import Game from '../../src/entities/game'
import PlayerFactory from './PlayerFactory'
import { rand, randText } from '@ngneat/falso'

export default class GameFeedbackFactory extends Factory<GameFeedback> {
  private game: Game

  constructor(game: Game) {
    super(GameFeedback)

    this.game = game
  }

  protected definition(): void {
    this.state(async () => {
      const category = await new GameFeedbackCategoryFactory(this.game).one()
      const player = await new PlayerFactory([this.game]).one()

      return {
        category,
        comment: randText(),
        anonymised: category.anonymised,
        playerAlias: rand(player.aliases.getItems())
      }
    })
  }
}
