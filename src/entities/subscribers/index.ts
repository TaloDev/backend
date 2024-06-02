import { EventSubscriber } from '@mikro-orm/mysql'
import PlayerSubscriber from './player.subscriber.js'

export default [
  PlayerSubscriber
] as EventSubscriber<unknown>[]
