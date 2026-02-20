import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import GameChannel from './game-channel'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop'

@Entity()
export default class GameChannelProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameChannel, { deleteRule: 'cascade' })
  gameChannel: GameChannel

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(gameChannel: GameChannel, key: string, value: string) {
    this.gameChannel = gameChannel
    this.key = key
    this.value = value
  }

  toJSON() {
    return {
      key: this.key,
      value: this.value,
    }
  }
}
