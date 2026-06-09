import { randUuid } from '@ngneat/falso'
import { Factory } from 'hefty'
import GameVerificationKey from '../../src/entities/game-verification-key.js'
import Game from '../../src/entities/game.js'

export default class GameVerificationKeyFactory extends Factory<GameVerificationKey> {
  private game: Game

  constructor(game: Game) {
    super(GameVerificationKey)

    this.game = game
  }

  protected override definition() {
    this.state(() => ({
      game: this.game,
      version: '1',
      value: randUuid(),
    }))
  }

  version(version: string): this {
    return this.state(() => ({ version }))
  }

  value(value: string): this {
    return this.state(() => ({ value }))
  }
}
