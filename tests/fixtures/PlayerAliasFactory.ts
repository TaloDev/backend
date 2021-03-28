import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAlias from '../../src/entities/player-alias'

export default class PlayerAliasFactory extends Factory<PlayerAlias> {
  constructor() {
    super(PlayerAlias, 'base')
    this.register('base', this.base)
  }

  protected base(): Partial<PlayerAlias> {
    const services = ['steam', 'origin', 'epic', 'username']
    const identifiers = [casual.uuid, casual.username, casual.card_number()]

    return {  
      service: casual.random_element(services),
      identifier: casual.random_element(identifiers)
    }
  }
}
