import { Factory } from 'hefty'
import casual from 'casual'
import LeaderboardEntry from '../../src/entities/leaderboard-entry'
import Leaderboard from '../../src/entities/leaderboard'
import Player from '../../src/entities/player'

export default class LeaderboardEntryFactory extends Factory<LeaderboardEntry> {
  private leaderboard: Leaderboard
  private availablePlayers: Player[]

  constructor(leaderboard: Leaderboard, availablePlayers: Player[]) {
    super(LeaderboardEntry)

    this.leaderboard = leaderboard
    this.availablePlayers = availablePlayers
  }

  protected definition(): void {
    this.state(async () => {
      const player: Player = casual.random_element(this.availablePlayers)
      await player.aliases.loadItems()

      return {
        leaderboard: this.leaderboard,
        playerAlias: casual.random_element(player.aliases.getItems()),
        score: Number(casual.double(10, 100000).toFixed(2)),
        hidden: false
      }
    })
  }

  hidden(): this {
    return this.state(() => ({
      hidden: true
    }))
  }
}
