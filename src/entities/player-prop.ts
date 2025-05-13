import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop'

@Entity()
export default class PlayerProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Player, { deleteRule: 'cascade' })
  player: Player

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(player: Player, key: string, value: string) {
    this.player = player
    this.key = key
    this.value = value
  }
}
