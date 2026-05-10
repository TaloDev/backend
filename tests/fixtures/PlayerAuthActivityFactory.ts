import { rand } from '@ngneat/falso'
import { Factory } from 'hefty'
import Game from '../../src/entities/game.js'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../src/entities/player-auth-activity.js'
import PlayerFactory from './PlayerFactory.js'

export default class PlayerAuthActivityFactory extends Factory<PlayerAuthActivity> {
  game: Game

  constructor(game: Game) {
    super(PlayerAuthActivity)

    this.game = game
  }

  protected override definition() {
    this.state(async () => ({
      type: rand([
        PlayerAuthActivityType.REGISTERED,
        PlayerAuthActivityType.VERIFICATION_STARTED,
        PlayerAuthActivityType.LOGGED_IN,
        PlayerAuthActivityType.LOGGED_OUT,
      ]),
      player: await new PlayerFactory([this.game]).withTaloAlias().one(),
    }))
  }
}
