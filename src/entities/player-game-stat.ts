import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import GameStat from './game-stat'
import Player from './player'

@Entity()
export default class PlayerGameStat {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Player, { deleteRule: 'cascade' })
  player: Player

  @ManyToOne(() => GameStat, { deleteRule: 'cascade', eager: true })
  stat: GameStat

  @Property({ type: 'double' })
  value: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(player: Player, stat: GameStat) {
    this.player = player
    this.stat = stat

    this.value = stat.defaultValue
  }

  toJSON() {
    return {
      id: this.id,
      stat: this.stat,
      value: this.value,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
