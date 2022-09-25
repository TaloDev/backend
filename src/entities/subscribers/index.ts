import { EventSubscriber } from '@mikro-orm/core'
import PlayerGroupSubscriber from './player-group.subscriber'
import PlayerPropSubscriber from './player-prop.subscriber'
import PlayerSubscriber from './player.subscriber'

export default [
  PlayerSubscriber,
  PlayerPropSubscriber,
  PlayerGroupSubscriber
] as EventSubscriber<unknown>[]
