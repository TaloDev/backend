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
    super(Leaderboard)

    this.availableGames = availableGames
  }

  protected definition(): void {
    this.state(() => ({
      game: casual.random_element(this.availableGames),
      internalName: casual.array_of_words(3).join('-'),
      name: casual.title,
      sortMode: casual.random_element([LeaderboardSortMode.ASC, LeaderboardSortMode.DESC]),
      unique: casual.boolean
    }))
  }

  unique(): this {
    return this.state(() => ({
      unique: true
    }))
  }

  notUnique(): this {
    return this.state(() => ({
      unique: false
    }))
  }

  withEntries(): this {
    return this.state(async (leaderboard: Leaderboard) => {
      const entryFactory = new LeaderboardEntryFactory(leaderboard, leaderboard.game.players.getItems())
      const entries = leaderboard.game.players.length > 0 ?
        await entryFactory.many(casual.integer(0, 20))
        : []

      return {
        entries: new Collection<LeaderboardEntry>(leaderboard, entries)
      }
    })
  }

  devBuildPlayers(): this {
    return this.state((leaderboard: Leaderboard) => {
      leaderboard.entries.getItems().forEach((entry) => {
        entry.playerAlias.player.addProp('META_DEV_BUILD', '1')
      })

      return {
        entries: leaderboard.entries
      }
    })
  }

  asc(): this {
    return this.state(() => ({
      sortMode: LeaderboardSortMode.ASC
    }))
  }

  desc(): this {
    return this.state(() => ({
      sortMode: LeaderboardSortMode.DESC
    }))
  }
}
