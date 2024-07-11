import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAlias, { PlayerAliasService } from '../../src/entities/player-alias'

export default class PlayerAliasFactory extends Factory<PlayerAlias> {
  constructor() {
    super(PlayerAlias, 'base')
    this.register('base', this.base)
    this.register('steam', this.steam)
    this.register('username', this.username)
    this.register('talo', this.talo)
  }

  protected base(): Partial<PlayerAlias> {
    const identifiers = [casual.uuid, casual.username, casual.card_number()]

    return {
      service: casual.random_element([
        PlayerAliasService.STEAM,
        PlayerAliasService.EPIC,
        PlayerAliasService.USERNAME,
        PlayerAliasService.EMAIL,
        PlayerAliasService.CUSTOM
      ]),
      identifier: casual.random_element(identifiers)
    }
  }

  protected steam(): Partial<PlayerAlias> {
    return {
      service: PlayerAliasService.STEAM,
      identifier: casual.integer(100000, 1000000).toString()
    }
  }

  protected username(): Partial<PlayerAlias> {
    return {
      service: PlayerAliasService.USERNAME,
      identifier: casual.username
    }
  }

  protected talo(): Partial<PlayerAlias> {
    return {
      service: PlayerAliasService.TALO,
      identifier: casual.uuid
    }
  }
}
