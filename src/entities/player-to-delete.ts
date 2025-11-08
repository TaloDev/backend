import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'

@Entity({ tableName: 'players_to_delete' })
export class PlayerToDelete {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Player, { deleteRule: 'cascade' })
  player: Player

  @Property()
  queuedAt: Date = new Date()

  constructor(player: Player) {
    this.player = player
  }
}
