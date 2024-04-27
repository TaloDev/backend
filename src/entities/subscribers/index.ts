import { EventSubscriber } from '@mikro-orm/mysql'
import PlayerSubscriber from './player.subscriber'

export default [
  PlayerSubscriber
] as EventSubscriber<unknown>[]
