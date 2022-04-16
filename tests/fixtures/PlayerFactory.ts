import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import casual from 'casual'
import Player from '../../src/entities/player'
import PlayerAliasFactory from './PlayerAliasFactory'
import { Collection } from '@mikro-orm/core'
import PlayerAlias from '../../src/entities/player-alias'
import { sub } from 'date-fns'
import Prop from '../../src/entities/prop'

export default class PlayerFactory extends Factory<Player> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(Player, 'base')
    this.register('base', this.base)
    this.register('not seen today', this.notSeenToday)
    this.register('not created this week', this.notCreatedThisWeek)
    this.register('not seen this week', this.notSeenThisWeek)
    this.register('seen this week', this.seenThisWeek)
    this.register('created this week', this.createdThisWeek)
    this.register('dev build', this.devBuild)

    this.availableGames = availableGames
  }

  protected async base(player: Player): Promise<Partial<Player>> {
    const availableProps = ['zonesExplored', 'currentArea', 'position.x', 'position.y', 'deaths', 'position.z', 'currentLevel', 'inventorySpace', 'currentHealth', 'currentMana', 'currentEnergy', 'npcKills', 'playerKills']
    const propsCount = casual.integer(0, 5)
    const props: Prop[] = []

    for (let i = 0; i < propsCount; i++) {
      props.push(new Prop(casual.random_element(availableProps), String(casual.integer(0, 99))))
    }

    const playerAliasFactory = new PlayerAliasFactory()
    const items = await playerAliasFactory.with(() => ({ player })).many(casual.integer(1, 2))
    const aliases = new Collection<PlayerAlias>(player, items)

    const lastSeenAt = sub(new Date(), { days: casual.integer(0, 10) })

    return {
      aliases,
      game: casual.random_element(this.availableGames),
      props,
      lastSeenAt
    }
  }

  protected notSeenToday(): Partial<Player> {
    return {
      lastSeenAt: sub(new Date(), { days: casual.integer(1, 99) })
    }
  }

  protected notCreatedThisWeek(): Partial<Player> {
    return {
      createdAt: sub(new Date(), { days: 8 })
    }
  }

  protected notSeenThisWeek(): Partial<Player> {
    return {
      lastSeenAt: sub(new Date(), { days: 8 })
    }
  }

  protected seenThisWeek(): Partial<Player> {
    return {
      lastSeenAt: sub(new Date(), { days: casual.integer(0, 6) })
    }
  }

  protected createdThisWeek(): Partial<Player> {
    return {
      lastSeenAt: sub(new Date(), { days: casual.integer(0, 6) }),
      createdAt: sub(new Date(), { days: casual.integer(0, 6) })
    }
  }

  protected devBuild(player: Player): Partial<Player> {
    player.props.push(new Prop('META_DEV_BUILD', '1'))
    return player
  }
}
