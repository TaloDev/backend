import { rand, randText } from '@ngneat/falso'
import { Factory } from 'hefty'
import GameFeedback from '../../src/entities/game-feedback.js'
import Game from '../../src/entities/game.js'
import GameFeedbackCategoryFactory from './GameFeedbackCategoryFactory.js'
import PlayerFactory from './PlayerFactory.js'

export default class GameFeedbackFactory extends Factory<GameFeedback> {
  private game: Game

  constructor(game: Game) {
    super(GameFeedback)

    this.game = game
  }

  protected override definition(): void {
    this.state(async () => {
      const category = await new GameFeedbackCategoryFactory(this.game).one()
      const player = await new PlayerFactory([this.game]).one()

      return {
        category,
        comment: randText(),
        anonymised: category.anonymised,
        playerAlias: rand(player.aliases.getItems()),
      }
    })
  }
}
