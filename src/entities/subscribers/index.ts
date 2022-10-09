import { EventSubscriber } from '@mikro-orm/core'
import PlayerSubscriber from './player.subscriber'

export default [
  PlayerSubscriber
] as EventSubscriber<unknown>[]
