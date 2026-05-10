import { Entity, ManyToOne, OneToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import GameStat from './game-stat.js'
import PlayerGameStat from './player-game-stat.js'

@Entity()
export class SteamworksPlayerStat {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameStat, { deleteRule: 'cascade' })
  stat: GameStat

  @OneToOne(() => PlayerGameStat, { nullable: true })
  playerStat: PlayerGameStat | null

  @Property()
  steamUserId: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor({
    stat,
    playerStat,
    steamUserId,
  }: {
    stat: GameStat
    playerStat: PlayerGameStat | null
    steamUserId: string
  }) {
    this.stat = stat
    this.playerStat = playerStat
    this.steamUserId = steamUserId
  }
}
