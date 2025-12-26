import { Factory } from 'hefty'
import LeaderboardEntry from '../../src/entities/leaderboard-entry'
import Leaderboard from '../../src/entities/leaderboard'
import Player from '../../src/entities/player'
import { rand, randFloat } from '@ngneat/falso'

export default class LeaderboardEntryFactory extends Factory<LeaderboardEntry> {
  private leaderboard: Leaderboard
  private availablePlayers: Player[]

  constructor(leaderboard: Leaderboard, availablePlayers: Player[]) {
    super(LeaderboardEntry)

    this.leaderboard = leaderboard
    this.availablePlayers = availablePlayers
  }

  protected override definition() {
    this.state(async (entry) => {
      const player: Player = rand(this.availablePlayers)
      await player.aliases.loadItems()

      return {
        leaderboard: this.leaderboard,
        playerAlias: rand(player.aliases.getItems()),
        score: Number(randFloat({ min: 10, max: 100000 })),
        hidden: false,
        propsDigest: LeaderboardEntry.createPropsDigest(entry.props.getItems())
      }
    })
  }

  hidden(): this {
    return this.state(() => ({
      hidden: true
    }))
  }

  archived(): this {
    return this.state(() => ({
      deletedAt: new Date()
    }))
  }
}
