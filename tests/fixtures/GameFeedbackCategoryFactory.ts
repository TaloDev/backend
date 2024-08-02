import { Factory } from 'hefty'
import casual from 'casual'
import GameFeedbackCategory from '../../src/entities/game-feedback-category'
import Game from '../../src/entities/game'

export default class GameFeedbackCategoryFactory extends Factory<GameFeedbackCategory> {
  private game: Game

  constructor(game: Game) {
    super(GameFeedbackCategory)

    this.game = game
  }

  protected definition(): void {
    this.state(() => ({
      internalName: casual.array_of_words(3).join('-'),
      name: casual.title,
      description: casual.short_description,
      game: this.game,
      anonymised: casual.boolean
    }))
  }
}
