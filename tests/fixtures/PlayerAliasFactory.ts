import { rand, randCreditCardNumber, randNumber, randUserName, randUuid } from '@ngneat/falso'
import { Factory } from 'hefty'
import Player from '../../src/entities/player'
import PlayerAlias, { PlayerAliasService } from '../../src/entities/player-alias'

export default class PlayerAliasFactory extends Factory<PlayerAlias> {
  private player: Player

  constructor(player: Player) {
    super(PlayerAlias)

    this.player = player
  }

  protected override definition() {
    const identifiers = [randUuid(), randUserName(), randCreditCardNumber()]
    this.state(() => ({
      service: rand([
        PlayerAliasService.STEAM,
        PlayerAliasService.EPIC,
        PlayerAliasService.USERNAME,
        PlayerAliasService.EMAIL,
        PlayerAliasService.CUSTOM,
      ]),
      identifier: rand(identifiers),
      player: this.player,
    }))
  }

  steam(): this {
    return this.state(() => ({
      service: PlayerAliasService.STEAM,
      identifier: randNumber({ min: 100_000, max: 1_000_000 }).toString(),
    }))
  }

  username(): this {
    return this.state(() => ({
      service: PlayerAliasService.USERNAME,
      identifier: randUserName(),
    }))
  }

  guest(): this {
    return this.state(() => ({
      service: PlayerAliasService.CUSTOM,
      identifier: `guest_${randUuid()}`,
    }))
  }

  talo(): this {
    return this.state(() => ({
      service: PlayerAliasService.TALO,
      identifier: randUuid(),
    }))
  }
}
