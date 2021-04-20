import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import casual from 'casual'
import Player from '../../src/entities/player'
import PlayerAliasFactory from './PlayerAliasFactory'
import { Collection } from '@mikro-orm/core'
import PlayerAlias from '../../src/entities/player-alias'
import { sub } from 'date-fns'

export default class PlayerFactory extends Factory<Player> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(Player, 'base')
    this.register('base', this.base)
    this.register('not seen today', this.notSeenToday)

    this.availableGames = availableGames
  }

  protected async base(player: Player): Promise<Partial<Player>> {
    const availableProps = ['zonesExplored', 'currentArea', 'position.x', 'position.y', 'deaths']
    const propsCount = casual.integer(0, 3)
    const props = {}

    for (let i = 0; i < propsCount; i++) {
      props[casual.random_element(availableProps)] = String(casual.integer(0, 99))
    }

    const playerAliasFactory = new PlayerAliasFactory()
    const items = await playerAliasFactory.with(() => ({ player })).many(casual.integer(1, 2))
    const aliases = new Collection<PlayerAlias>(this, items)

    return {  
      aliases,
      game: casual.random_element(this.availableGames),
      props,
      lastSeenAt: sub(new Date(), { days: casual.integer(0, 3) })
    }
  }

  protected notSeenToday(): Partial<Player> {
    return {
      lastSeenAt: sub(new Date(), { days: casual.integer(1, 7) })
    }
  }
}
