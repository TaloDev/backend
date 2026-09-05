import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es'
import GameStat from './game-stat.js'
import Integration from './integration.js'
import PlayerGameStat from './player-game-stat.js'

@Entity()
@Unique({ properties: ['integration', 'playerStat'] })
export class SteamworksPlayerStat {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameStat, { deleteRule: 'cascade' })
  stat: GameStat

  @ManyToOne(() => Integration, { deleteRule: 'cascade' })
  integration: Integration

  @ManyToOne(() => PlayerGameStat, { nullable: true, deleteRule: 'set null' })
  playerStat: PlayerGameStat | null

  @Property()
  steamUserId: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor({
    stat,
    integration,
    playerStat,
    steamUserId,
  }: {
    stat: GameStat
    integration: Integration
    playerStat: PlayerGameStat | null
    steamUserId: string
  }) {
    this.stat = stat
    this.integration = integration
    this.playerStat = playerStat
    this.steamUserId = steamUserId
  }
}
