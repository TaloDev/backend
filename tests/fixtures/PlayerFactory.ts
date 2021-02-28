import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import casual from 'casual'
import Player from '../../src/entities/player'

export default class PlayerFactory extends Factory<Player> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(Player, 'base')
    this.register('base', this.base)

    this.availableGames = availableGames
  }

  protected base(): Partial<Player> {
    const aliasProviders = ['steam', 'origin', 'epic', 'username']
    const aliasValues = [casual.uuid, casual.username, casual.card_number()]
    const aliasCount = casual.integer(0, 3)
    const aliases = {}

    for (let i = 0; i < aliasCount; i++) {
      aliases[casual.random_element(aliasProviders)] = casual.random_element(aliasValues)
    }

    const availableProps = ['zonesExplored', 'currentArea', 'position.x', 'position.y', 'deaths']
    const propsCount = casual.integer(0, 3)
    const props = {}

    for (let i = 0; i < propsCount; i++) {
      props[casual.random_element(availableProps)] = casual.integer(0, 99)
    }

    return {  
      aliases,
      game: casual.random_element(this.availableGames),
      props
    }
  }
}
