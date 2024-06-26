import { Factory } from 'hefty'
import casual from 'casual'
import Leaderboard, { LeaderboardSortMode } from '../../src/entities/leaderboard'
import Game from '../../src/entities/game'
import LeaderboardEntryFactory from './LeaderboardEntryFactory'
import { Collection } from '@mikro-orm/mysql'
import LeaderboardEntry from '../../src/entities/leaderboard-entry'

export default class LeaderboardFactory extends Factory<Leaderboard> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(Leaderboard, 'base')
    this.register('base', this.base)
    this.register('with entries', this.withEntries)
    this.register('unique', this.unique)
    this.register('not unique', this.notUnique)
    this.register('dev build players', this.devBuildPlayers)
    this.register('asc', this.asc)
    this.register('desc', this.desc)

    this.availableGames = availableGames
  }

  protected async base(): Promise<Partial<Leaderboard>> {
    return {
      game: casual.random_element(this.availableGames),
      internalName: casual.array_of_words(3).join('-'),
      name: casual.title,
      sortMode: casual.random_element([LeaderboardSortMode.ASC, LeaderboardSortMode.DESC]),
      unique: casual.boolean
    }
  }

  protected unique(): Partial<Leaderboard> {
    return {
      unique: true
    }
  }

  protected notUnique(): Partial<Leaderboard> {
    return {
      unique: false
    }
  }

  protected async withEntries(leaderboard: Leaderboard): Promise<Partial<Leaderboard>> {
    const entryFactory = new LeaderboardEntryFactory(leaderboard, leaderboard.game.players.getItems())
    const entries = leaderboard.game.players.length > 0 ?
      await entryFactory.many(casual.integer(0, 20))
      : []

    return {
      entries: new Collection<LeaderboardEntry>(leaderboard, entries)
    }
  }

  protected async devBuildPlayers(leaderboard: Leaderboard): Promise<Partial<Leaderboard>> {
    leaderboard.entries.getItems().forEach((entry) => {
      entry.playerAlias.player.addProp('META_DEV_BUILD', '1')
    })

    return leaderboard
  }

  protected asc(): Partial<Leaderboard> {
    return {
      sortMode: LeaderboardSortMode.ASC
    }
  }

  protected desc(): Partial<Leaderboard> {
    return {
      sortMode: LeaderboardSortMode.DESC
    }
  }
}
