import { randText } from '@ngneat/falso'
import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import GameChannel from '../../src/entities/game-channel'
import PlayerFactory from './PlayerFactory'

export default class GameChannelFactory extends Factory<GameChannel> {
  private game: Game

  constructor(game: Game) {
    super(GameChannel)

    this.game = game
  }

  protected override definition() {
    this.state(async () => ({
      name: randText(),
      owner: (await new PlayerFactory([this.game]).one()).aliases[0],
      game: this.game,
      private: false,
    }))
  }

  private() {
    return this.state(() => ({
      private: true,
    }))
  }

  temporaryMembership(): this {
    return this.state(() => ({
      temporaryMembership: true,
    }))
  }
}
