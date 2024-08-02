import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../src/entities/player-auth-activity'
import PlayerFactory from './PlayerFactory'
import Game from '../../src/entities/game'

export default class PlayerAuthActivityFactory extends Factory<PlayerAuthActivity> {
  game: Game

  constructor(game: Game) {
    super(PlayerAuthActivity)

    this.game = game
  }

  protected definition(): void {
    this.state(async () => ({
      type: casual.random_element([
        PlayerAuthActivityType.REGISTERED,
        PlayerAuthActivityType.VERIFICATION_STARTED,
        PlayerAuthActivityType.LOGGED_IN,
        PlayerAuthActivityType.LOGGED_OUT
      ]),
      player: await new PlayerFactory([this.game]).withTaloAlias().one()
    }))
  }
}
