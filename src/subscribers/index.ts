import { GameChannelSubscriber } from './game-channel.subscriber'
import { LeaderboardEntrySubscriber } from './leaderboard-entry.subscriber'
import { PlayerGameStatSubscriber } from './player-game-stat.subscriber'
import { PlayerAliasSubscriptionSubscriber } from './player-alias-subscription.subscriber'

export const subscribers = [
  GameChannelSubscriber,
  LeaderboardEntrySubscriber,
  PlayerGameStatSubscriber,
  PlayerAliasSubscriptionSubscriber
]
