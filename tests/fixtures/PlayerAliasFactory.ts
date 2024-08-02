import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAlias, { PlayerAliasService } from '../../src/entities/player-alias'
import Player from '../../src/entities/player'

export default class PlayerAliasFactory extends Factory<PlayerAlias> {
  private player: Player

  constructor(player: Player) {
    super(PlayerAlias)

    this.player = player
  }

  protected definition(): void {
    const identifiers = [casual.uuid, casual.username, casual.card_number()]
    this.state(() => ({
      service: casual.random_element([
        PlayerAliasService.STEAM,
        PlayerAliasService.EPIC,
        PlayerAliasService.USERNAME,
        PlayerAliasService.EMAIL,
        PlayerAliasService.CUSTOM
      ]),
      identifier: casual.random_element(identifiers),
      player: this.player
    }))
  }

  steam(): this {
    return this.state(() => ({
      service: PlayerAliasService.STEAM,
      identifier: casual.integer(100000, 1000000).toString()
    }))
  }

  username(): this {
    return this.state(() => ({
      service: PlayerAliasService.USERNAME,
      identifier: casual.username
    }))
  }

  talo(): this {
    return this.state(() => ({
      service: PlayerAliasService.TALO,
      identifier: casual.uuid
    }))
  }
}
