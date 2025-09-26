import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import { MAX_KEY_LENGTH } from './prop'

@Entity()
export default class PlayerProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Player, { deleteRule: 'cascade' })
  player: Player

  @Index()
  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ type: 'text' })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(player: Player, key: string, value: string) {
    this.player = player
    this.key = key
    this.value = value
  }

  toJSON() {
    return {
      key: this.key,
      value: this.value
    }
  }
}
