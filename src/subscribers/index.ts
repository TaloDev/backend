import { GameChannelSubscriber } from './game-channel.subscriber'
import { LeaderboardEntrySubscriber } from './leaderboard-entry.subscriber'
import { PlayerGameStatSubscriber } from './player-game-stat.subscriber'

export const subscribers = [
  GameChannelSubscriber,
  LeaderboardEntrySubscriber,
  PlayerGameStatSubscriber
]
