import { Factory } from 'hefty'
import casual from 'casual'
import Leaderboard, { LeaderboardSortMode } from '../../src/entities/leaderboard'
import Game from '../../src/entities/game'
import LeaderboardEntryFactory from './LeaderboardEntryFactory'
import { Collection } from '@mikro-orm/core'
import LeaderboardEntry from '../../src/entities/leaderboard-entry'

export default class LeaderboardFactory extends Factory<Leaderboard> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(Leaderboard, 'base')
    this.register('base', this.base)
    this.register('unique', this.unique)
    this.register('not unique', this.notUnique)

    this.availableGames = availableGames
  }

  protected async base(leaderboard: Leaderboard): Promise<Partial<Leaderboard>> {
    const game = casual.random_element(this.availableGames)
    const entryFactory = new LeaderboardEntryFactory(leaderboard, game.players)
    const entries = game.players.length > 0 ?
      await entryFactory.many(casual.integer(0, 20))
      : []

    return {
      game,
      internalName: casual.word,
      name: casual.title,
      sortMode: casual.random_element(Object.keys(LeaderboardSortMode)),
      unique: casual.boolean,
      entries: new Collection<LeaderboardEntry>(leaderboard, entries)
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
}
