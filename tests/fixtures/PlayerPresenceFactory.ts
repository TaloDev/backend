import { Factory } from 'hefty'
import PlayerPresence from '../../src/entities/player-presence'
import { randBoolean, randText } from '@ngneat/falso'
import PlayerFactory from './PlayerFactory'
import Game from '../../src/entities/game'
import PlayerAlias from '../../src/entities/player-alias'

export default class PlayerPresenceFactory extends Factory<PlayerPresence> {
  private game: Game

  constructor(game: Game) {
    super(PlayerPresence)
    this.game = game
  }

  protected definition(): void {
    this.state(async () => {
      const player = await new PlayerFactory([this.game]).one()
      await player.aliases.loadItems()

      return {
        player,
        playerAlias: player.aliases[0],
        online: randBoolean(),
        customStatus: randText()
      }
    })
  }

  online(): this {
    return this.state(() => ({
      online: true
    }))
  }

  offline(): this {
    return this.state(() => ({
      online: false
    }))
  }

  withAlias(alias: PlayerAlias): this {
    return this.state(() => ({
      playerAlias: alias
    }))
  }

  withCustomStatus(status: string): this {
    return this.state(() => ({
      customStatus: status
    }))
  }
}
