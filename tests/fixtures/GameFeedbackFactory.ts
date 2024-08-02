import { Factory } from 'hefty'
import casual from 'casual'
import GameFeedback from '../../src/entities/game-feedback'
import GameFeedbackCategoryFactory from './GameFeedbackCategoryFactory'
import Game from '../../src/entities/game'
import PlayerFactory from './PlayerFactory'

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
        comment: casual.sentence,
        anonymised: category.anonymised,
        playerAlias: casual.random_element(player.aliases.getItems())
      }
    })
  }
}
