import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../src/entities/player-auth-activity'
import PlayerFactory from './PlayerFactory'
import Game from '../../src/entities/game'

export default class PlayerAuthActivityFactory extends Factory<PlayerAuthActivity> {
  game: Game

  constructor(game: Game) {
    super(PlayerAuthActivity, 'base')
    this.register('base', this.base)

    this.game = game
  }

  protected async base(): Promise<Partial<PlayerAuthActivity>> {
    return {
      type: casual.random_element([
        PlayerAuthActivityType.REGISTERED,
        PlayerAuthActivityType.VERIFICATION_STARTED,
        PlayerAuthActivityType.VERIFICATION_FAILED,
        PlayerAuthActivityType.LOGGED_IN,
        PlayerAuthActivityType.LOGGED_OUT,
        PlayerAuthActivityType.CHANGED_PASSWORD,
        PlayerAuthActivityType.CHANGED_EMAIL,
        PlayerAuthActivityType.PASSWORD_RESET_REQUESTED,
        PlayerAuthActivityType.PASSWORD_RESET_COMPLETED
      ]),
      player: await new PlayerFactory([this.game]).state('with talo alias').one()
    }
  }
}
