import { Factory } from 'hefty'
import GameFeedbackCategory from '../../src/entities/game-feedback-category'
import Game from '../../src/entities/game'
import { randBoolean, randSlug, randText } from '@ngneat/falso'

export default class GameFeedbackCategoryFactory extends Factory<GameFeedbackCategory> {
  private game: Game

  constructor(game: Game) {
    super(GameFeedbackCategory)

    this.game = game
  }

  protected definition(): void {
    this.state(() => ({
      internalName: randSlug(),
      name: randText(),
      description: randText(),
      game: this.game,
      anonymised: randBoolean()
    }))
  }
}
