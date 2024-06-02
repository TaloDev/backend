import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAlias, { PlayerAliasService } from '../../src/entities/player-alias.js'

export default class PlayerAliasFactory extends Factory<PlayerAlias> {
  constructor() {
    super(PlayerAlias, 'base')
    this.register('base', this.base)
    this.register('steam', this.steam)
    this.register('username', this.username)
  }

  protected base(): Partial<PlayerAlias> {
    const identifiers = [casual.uuid, casual.username, casual.card_number()]

    return {
      service: casual.random_element(Object.values(PlayerAliasService)),
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
}
