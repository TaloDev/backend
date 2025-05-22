import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop'
import GameChannel from './game-channel'
import PlayerAlias from './player-alias'

@Entity()
export default class GameChannelStorageProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameChannel, { deleteRule: 'cascade' })
  gameChannel: GameChannel

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade' })
  createdBy!: PlayerAlias

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(gameChannel: GameChannel, key: string, value: string) {
    this.gameChannel = gameChannel
    this.key = key
    this.value = value
  }
}
