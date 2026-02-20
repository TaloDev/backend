import { randBoolean, randSlug, randText } from '@ngneat/falso'
import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import GameFeedbackCategory from '../../src/entities/game-feedback-category'

export default class GameFeedbackCategoryFactory extends Factory<GameFeedbackCategory> {
  private game: Game

  constructor(game: Game) {
    super(GameFeedbackCategory)

    this.game = game
  }

  protected override definition() {
    this.state(() => ({
      internalName: randSlug(),
      name: randText(),
      description: randText(),
      game: this.game,
      anonymised: randBoolean(),
    }))
  }
}
