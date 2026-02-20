import { randBoolean, randText } from '@ngneat/falso'
import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import PlayerAlias from '../../src/entities/player-alias'
import PlayerPresence from '../../src/entities/player-presence'
import PlayerFactory from './PlayerFactory'

export default class PlayerPresenceFactory extends Factory<PlayerPresence> {
  private game: Game

  constructor(game: Game) {
    super(PlayerPresence)
    this.game = game
  }

  protected override definition() {
    this.state(async (presence) => {
      const player = presence.player ?? (await new PlayerFactory([this.game]).one())
      await player.aliases.loadItems()

      return {
        player,
        playerAlias: player.aliases[0],
        online: randBoolean(),
        customStatus: randText(),
      }
    })
  }

  online(): this {
    return this.state(() => ({
      online: true,
    }))
  }

  offline(): this {
    return this.state(() => ({
      online: false,
    }))
  }

  withAlias(alias: PlayerAlias): this {
    return this.state(() => ({
      playerAlias: alias,
    }))
  }

  withCustomStatus(status: string): this {
    return this.state(() => ({
      customStatus: status,
    }))
  }
}
