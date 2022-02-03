import { Factory } from 'hefty'
import casual from 'casual'
import LeaderboardEntry from '../../src/entities/leaderboard-entry'
import Leaderboard from '../../src/entities/leaderboard'
import Player from '../../src/entities/player'

export default class LeaderboardEntryFactory extends Factory<LeaderboardEntry> {
  private leaderboard: Leaderboard
  private availablePlayers: Player[]

  constructor(leaderboard: Leaderboard, availablePlayers: Player[]) {
    super(LeaderboardEntry, 'base')
    this.register('base', this.base)
    this.register('hidden', this.hidden)

    this.leaderboard = leaderboard
    this.availablePlayers = availablePlayers
  }

  protected async base(): Promise<Partial<LeaderboardEntry>> {
    const player: Player = casual.random_element(this.availablePlayers)
    await player.aliases.loadItems()

    return {
      leaderboard: this.leaderboard,
      playerAlias: casual.random_element(player.aliases.getItems()),
      score: Number(casual.double(10, 100000).toFixed(2)),
      hidden: false
    }
  }

  protected hidden(): Partial<LeaderboardEntry> {
    return {
      hidden: true
    }
  }
}
