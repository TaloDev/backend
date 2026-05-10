import { GameChannelSubscriber } from './game-channel.subscriber.js'
import { LeaderboardEntrySubscriber } from './leaderboard-entry.subscriber.js'
import { PlayerAliasSubscriptionSubscriber } from './player-alias-subscription.subscriber.js'
import { PlayerGameStatSubscriber } from './player-game-stat.subscriber.js'

export const subscribers = [
  GameChannelSubscriber,
  LeaderboardEntrySubscriber,
  PlayerGameStatSubscriber,
  PlayerAliasSubscriptionSubscriber,
]
