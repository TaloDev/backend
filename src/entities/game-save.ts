import { Cascade, Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Player from './player'

@Entity()
export default class GameSave {
  @PrimaryKey()
  id: number

  @Property()
  name: string

  @Property({ type: 'json' })
  content: { [key: string]: unknown }

  @ManyToOne(() => Player, { cascade: [Cascade.REMOVE] })
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
      updatedAt: this.updatedAt
    }
  }
}