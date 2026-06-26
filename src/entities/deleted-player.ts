import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import Game from './game.js'
import Player from './player.js'

@Entity()
@Index({ properties: ['game', 'createdAt'] })
export default class DeletedPlayer {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Game, { deleteRule: 'cascade' })
  game: Game

  @Property()
  devBuild: boolean = false

  @Property()
  createdAt: Date = new Date()

  @Property()
  deletedAt: Date = new Date()

  constructor(player: Player) {
    this.game = player.game
    this.devBuild = player.devBuild
    this.createdAt = player.createdAt
  }
}
