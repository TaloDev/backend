import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'

@Entity()
export default class GameSave {
  @PrimaryKey()
  id!: number

  @Property()
  name: string

  @Property({ type: 'json' })
  content!: { [key: string]: unknown }

  @ManyToOne(() => Player)
  player: Player

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(name: string, player: Player) {
    this.name = name
    this.player = player
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      content: this.content,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
