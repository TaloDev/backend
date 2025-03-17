import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'

@Entity()
export default class PlayerProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Player)
  player: Player

  @Property()
  key: string

  @Property()
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(player: Player, key: string, value: string) {
    this.player = player
    this.key = key
    this.value = value
  }
}
