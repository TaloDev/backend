import { Factory } from 'hefty'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../src/entities/player-auth-activity'
import PlayerFactory from './PlayerFactory'
import Game from '../../src/entities/game'
import { rand } from '@ngneat/falso'

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
        PlayerAuthActivityType.LOGGED_OUT
      ]),
      player: await new PlayerFactory([this.game]).withTaloAlias().one()
    }))
  }
}
