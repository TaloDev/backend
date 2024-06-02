import { Entity, ManyToOne, PrimaryKey, Property, Rel } from '@mikro-orm/mysql'
import Player from './player.js'

@Entity()
export default class PlayerProp {
  @PrimaryKey()
  id: number

  @ManyToOne(() => Player)
  player: Rel<Player>

  @Property()
  key: string

  @Property()
  value: string

  constructor(player: Rel<Player>, key: string, value: string) {
    this.player = player
    this.key = key
    this.value = value
  }
}
