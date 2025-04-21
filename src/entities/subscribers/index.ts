import { EventSubscriber } from '@mikro-orm/mysql'
import PlayerGroupSubscriber from './player-group.subscriber'

export default [
  PlayerGroupSubscriber
] as EventSubscriber<unknown>[]
